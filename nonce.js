const express = require('express');
const bodyParser = require('body-parser');
const cors = require("cors");
const { Serialize } = require('eosjs');
const { TextEncoder, TextDecoder } = require('util');
const crypto = require('crypto');

const router = express.Router();
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json())
router.use(cors());

router.post('/worker', async (req, res) => {
    const {
        account,
        DiffBagLand,
        last_mine_tx
    } = req.body
    const mine_work = await setHash({
        account,
        DiffBagLand,
        last_mine_tx
    });
    res.json(mine_work)
    // res.json({account: account})  // <==== req.body will be a parsed JSON object
})

const fromHexString = hexString =>
    new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

const nameToArray = (name) => {
    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });

    sb.pushName(name);

    return sb.array;
}

const setHash = async (mining_params) => {
    mining_params.last_mine_tx = mining_params.last_mine_tx.substr(0, 16); // only first 8 bytes of txid
    mining_params.last_mine_arr = fromHexString(mining_params.last_mine_tx);
    mining_params.account_str = mining_params.account;
    mining_params.account = nameToArray(mining_params.account);

    const getRand = () => {
        const arr = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
            const rand = Math.floor(Math.random() * 255);
            arr[i] = rand;
        }
        return arr;
    };

    const toHex = (buffer) => {
        return [...new Uint8Array(buffer)]
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    };


    mining_params.account = mining_params.account.slice(0, 8);
    let good = false, itr = 0, hex_digest, rand_arr, last;
    const combined = new Uint8Array(24);
    combined.set(mining_params.account);
    combined.set(mining_params.last_mine_arr, 8);
    const start = (new Date()).getTime();
    while (!good) {
        rand_arr = getRand();
        combined.set(rand_arr, 16);
        hex_digest = crypto.createHash('sha256').update(combined).digest('hex');
        good = hex_digest.substr(0, 4) === '0000';
        if (good) {
            last = parseInt(hex_digest.substr(4, 1), 16);
            good &= (last <= mining_params.DiffBagLand);
        }
        itr++;
        if (itr % 500000 === 0) {
                const mine_work = { account: mining_params.account_str, rand_str: "0", hex_digest: "0" };
                return mine_work;
            }
    }
    const end = (new Date()).getTime();
    const rand_str = toHex(rand_arr);
    console.log(`${mining_params.account_str} nonce: ${rand_str}, taking ${(end - start) / 1000}s`)
    const mine_work = {
        account: mining_params.account_str,
        rand_str,
        hex_digest
    };
    return mine_work;
};

module.exports = router;
