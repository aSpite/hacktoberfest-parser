import {MyDatabase} from "./db/database";
import {configDotenv} from "dotenv";
import {MyBot} from "./modules/telegram/bot";
import {handleTGMessages} from "./modules/telegram/bot.worker";
import {DiscordBot} from "./modules/discord/discord.bot";
import {handleDiscordMessages} from "./modules/discord/discord.worker";
import {parseIssues} from "./modules/parser";
import {TelegramClient} from "telegram";
import {StringSession} from "telegram/sessions";
import input from "input";

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
    const userBot = new TelegramClient(
        new StringSession(process.env.TELEGRAM_USER_SESSION),
        parseInt(process.env.TELEGRAM_API_ID),
        process.env.TELEGRAM_API_HASH, {
        connectionRetries: 5,
    });
    await userBot.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () =>
            await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    // console.log(client.session.save()); // Save this string to avoid logging in again

    const parser = setInterval(parseIssues, 1000 * 60 * 15, db);
    const tgMessages = setInterval(handleTGMessages, 1000 * 5, bot.bot, userBot);
    const discordMessages = setInterval(handleDiscordMessages, 1000 * 5, bot.bot, discord.client);
}

main().finally(() => console.log("Exiting..."));

