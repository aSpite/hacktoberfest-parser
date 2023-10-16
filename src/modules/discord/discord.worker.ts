import {Bot} from "grammy";
import {MyContext} from "../telegram/bot";
import {db} from "../../index";
import fs from "fs";
import {getCurrentTimeFormatted, sleep} from "../../utils/utils";
import {LOG_PREFIXES, LOG_TYPES} from "../../config";
import {Client, MessageAttachment} from "discord.js-selfbot-v13";

let flag = false;
export async function handleDiscordMessages(bot: Bot<MyContext>, client: Client<boolean>) {
    const tasks = await db.getDiscordTasks();
    const config = await db.getConfig();
    if(tasks.length === 0) {
        if(flag) {
            flag = false;
            await bot.api.sendMessage(config.serviceChatID, `✅ All discord tasks are completed.`);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.discord_bot}] [${LOG_TYPES.info}]: All discord tasks are completed.\n`, {flag: 'a'});
        }
        return;
    }

    if(!flag) {
        flag = true;
        await bot.api.sendMessage(config.serviceChatID, `📝 Starting discord tasks...`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.discord_bot}] [${LOG_TYPES.info}]: Starting discord tasks...\n`, {flag: 'a'});
    }

    const issues = JSON.parse(fs.readFileSync('issues.json', 'utf8'));

    let message = `📌 New issues for Hacktoberfest 2023:\n\n`;
    message += '🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻\n\n';
    for(const issue of issues) {
        if(issue.category !== 'ton') continue;
        message += `🔹 [${issue.title}](<${issue.url}>)\n`;
    }

    for(const issue of issues) {
        if(issue.category !== 'overall') continue;
        message += `🔹 [${issue.title}](<${issue.url}>)\n`;
    }


    for(const task of tasks) {
        try {
            const channel = await client.channels.fetch(task);
            if(channel.isText()) {
                MessageAttachment
                await channel.send({
                    content: message,
                    files: [new MessageAttachment('ff.jpg')]
                });
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.discord_bot}] [${LOG_TYPES.info}]: Message sent to ${task}\n`, {flag: 'a'});
            } else {
                await bot.api.sendMessage(config.serviceChatID, `❌ Error while sending message to ${task}: Channel is not a text channel.`);
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.discord_bot}] [${LOG_TYPES.error}]: Channel is not a text channel.\n`, {flag: 'a'});
            }
            } catch(e) {
            await bot.api.sendMessage(config.serviceChatID, `❌ Error while sending message to ${task}: ${e}`);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.discord_bot}] [${LOG_TYPES.error}]: ${e}\n`, {flag: 'a'});
        }

        await db.handleDiscordTask(task);
        await sleep(2000);
    }
}