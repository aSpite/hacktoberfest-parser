import {MyDatabase} from "./db/database";
import {configDotenv} from "dotenv";
import {MyBot, MyContext} from "./modules/telegram/bot";
import {handleTGMessages} from "./modules/telegram/bot.worker";
import {DiscordBot} from "./modules/discord/discord.bot";
import {handleDiscordMessages} from "./modules/discord/discord.worker";
import {parseIssues} from "./modules/parser";


export let db: MyDatabase;
export let bot: MyBot
export let discord: DiscordBot;
async function main() {
    configDotenv();
    db = new MyDatabase();
    await db.init();
    bot = new MyBot();
    await bot.start();
    discord = new DiscordBot();
    await discord.client.login(process.env.DISCORD_SELF_TOKEN);
    const parser = setInterval(parseIssues, 1000 * 60 * 15, db);
    const tgMessages = setInterval(handleTGMessages, 1000 * 5, bot.bot);
    const discordMessages = setInterval(handleDiscordMessages, 1000 * 5, bot.bot, discord.client);

}

main().finally(() => console.log("Exiting..."));

