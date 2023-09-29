import {MyContext} from "./bot";
import {Bot, GrammyError} from "grammy";
import fs from "fs";
import {db} from "../../index";
import {LOG_PREFIXES, LOG_TYPES} from "../../config";
import {getCurrentTimeFormatted, sleep} from "../../utils/utils";

let flag = false;

export async function handleTGMessages(bot: Bot<MyContext>) {
    const tasks = await db.getTelegramTasks();
    const config = await db.getConfig();
    if(tasks.length === 0) {
        if(flag) {
            flag = false;
            await bot.api.sendMessage(config.serviceChatID, `✅ All telegram tasks are completed.`);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: All telegram tasks are completed.\n`, {flag: 'a'});
        }
        return;
    }

    if(!flag) {
        flag = true;
        await bot.api.sendMessage(config.serviceChatID, `📝 Starting telegram tasks...`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Starting telegram tasks...\n`, {flag: 'a'});
    }

    const issues = JSON.parse(fs.readFileSync('issues.json', 'utf8'));
    const message = getMessage(issues);
    for(const task of tasks) {
        try {
            await bot.api.sendMessage(task, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Message sent to ${task}\n`, {flag: 'a'});
        } catch(e) {
            if(e instanceof GrammyError) {
                await bot.api.sendMessage(config.serviceChatID, `❌ Error while sending message to ${task}: ${e.description}`);
            }
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: ${e.description}\n`, {flag: 'a'});
        }

        await db.handleTelegramTask(task);
        await sleep(200);
    }
}

export function getMessage(issues: any) {
    let message = `📌 New issues for HackToBerFest:\n\n`;
    for(const issue of issues) {
        if(issue.category !== 'overall') continue;
        issue.title = issue.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        message += `🔹 <a href="${issue.url}">${issue.title}</a>\n\n`;
    }
    message += `\n📌 New issues for HackTONBerFest:\n\n`;
    for(const issue of issues) {
        if(issue.category !== 'ton') continue;
        issue.title = issue.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        message += `🔹 <a href="${issue.url}">${issue.title}</a>\n\n`;
    }

    return message;
}