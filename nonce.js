const express = require('express')
const axios = require('./axios')
const crypto = require("crypto");
const router = express.Router()

function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

router.get('/', (req, res) => {
    res.json({ account: "Hello World" })  // <==== req.body will be a parsed JSON object
})

router.post('/worker', async (req, res) => {
    const { account, DiffBagLand, last_mine_tx } = req.body
    const mine_work = await background_mine(account, DiffBagLand, last_mine_tx);
    res.json(mine_work)
    //return res.status(200).send({ mined: mine_work })
})

const fromHexString = hexString =>
    new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

const toHexString = bytes =>
    bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const nameToInt = (name) => {
    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });

    sb.pushName(name);

    const name_64 = new Int64LE(sb.array);

    return name_64 + '';
}

const nameToArray = (name) => {
    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });

    sb.pushName(name);

    return sb.array;
}

const intToName = (int) => {
    int = new Int64LE(int);

    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });

    sb.pushArray(int.toArray());

    const name = sb.getName();

    return name;
}

const mining_account = "m.federation";
const background_mine = async (account, difficulty, last_mine_tx) => {
    const MineWork = setHash({ mining_account, account, difficulty, last_mine_tx });
    return MineWork;
};

const setHash = async (mining_params) => {
    mining_params.last_mine_tx = mining_params.last_mine_tx.substr(0, 16); // only first 8 bytes of txid
    mining_params.last_mine_arr = fromHexString(mining_params.last_mine_tx);

    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });
    mining_params.sb = sb;

    mining_params.account_str = mining_params.account;
    mining_params.account = nameToArray(mining_params.account);


    // console.log('mining_params', _message)
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

    const is_wam = mining_params.account_str.substr(-4) === '.wam';

    let good = false, itr = 0, rand = 0, hash, hex_digest, rand_arr, last;
    const start = (new Date()).getTime();

    while (!good) {
        rand_arr = getRand();

        // console.log('combining', mining_params.account, mining_params.last_mine_arr, rand_arr);
        const combined = new Uint8Array(mining_params.account.length + mining_params.last_mine_arr.length + rand_arr.length);
        combined.set(mining_params.account);
        combined.set(mining_params.last_mine_arr, mining_params.account.length);
        combined.set(rand_arr, mining_params.account.length + mining_params.last_mine_arr.length);

        hash = crypto.createHash("sha256");
        hash.update(combined.slice(0, 24));
        hex_digest = hash.digest('hex');
        // console.log('combined slice', combined.slice(0, 24))
        // hash = await crypto.subtle.digest('SHA-256', combined.slice(0, 24));
        // console.log(hash);
        // hex_digest = toHex(hash);
        // console.log(hex_digest);
        if (is_wam) {
            // easier for .wam accounts
            good = hex_digest.substr(0, 4) === '0000';
        }
        else {
            // console.log(`non-wam account, mining is harder`)
            good = hex_digest.substr(0, 6) === '000000';
        }

        if (good) {
            if (is_wam) {
                last = parseInt(hex_digest.substr(4, 1), 16);
            }
            else {
                last = parseInt(hex_digest.substr(6, 1), 16);
            }
            good &= (last <= mining_params.difficulty);
            // console.log(hex_digest, good);
        }
        itr++;

        if (itr % 500000 === 0) {
            console.log(`Account ${mining_params.account_str}, Still mining - tried ${itr} iterations`);
            const mine_work = { account: mining_params.account_str, rand_str: "0", hex_digest: "0" };
            return mine_work;		
        }

        if (!good) {
            hash = null;
        }

    }
    const end = (new Date()).getTime();

    // console.log(sb.array.slice(0, 20));
    // const rand_str = Buffer.from(sb.array.slice(16, 24)).toString('hex');
    const rand_str = toHex(rand_arr);

    console.log(`Account ${mining_params.account_str}, rand_str ${rand_str}, taking ${(end - start) / 1000}s`)
    const mine_work = { account: mining_params.account_str, rand_str, hex_digest };
    // console.log(mine_work);
    // this.postMessage(mine_work);
    return mine_work;
};

module.exports = router;
