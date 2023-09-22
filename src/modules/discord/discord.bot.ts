import {Client} from "discord.js-selfbot-v13";
import fs from "fs";
import {LOG_PREFIXES, LOG_TYPES} from "../../config";
import {getCurrentTimeFormatted} from "../../utils/utils";

export class DiscordBot {
    readonly client: Client;

    constructor() {
        this.client = new Client();
        this.client.on('ready', () => {
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.discord_bot}] [${LOG_TYPES.info}]: Discord bot is ready\n`, {flag: 'a'});
        });
    }
}