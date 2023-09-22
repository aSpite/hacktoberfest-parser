import {MyConservation, MyContext} from "./bot";
import fs from "fs";
import {getCurrentTimeFormatted} from "../../utils/utils";
import {LOG_PREFIXES, LOG_TYPES} from "../../config";
import {bot, db, discord} from "../../index";

export async function setStarCriteria(
    conversation: MyConservation,
    ctx: MyContext,
) {
    ctx.session.stage = 'set_star_criteria';
    await ctx.reply(`Set star criteria as a number from 1

For leave, type /cancel`);

    let starCriteria = 0;
    do {
        const newCtx = await conversation.waitFor('message:text');
        if(newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        starCriteria = parseInt(newCtx.update.message.text);
        if(isNaN(starCriteria) || starCriteria < 1) {
            await newCtx.reply('Invalid number');
            continue;
        }
        ctx = newCtx;
        break;
    } while(true)
    await db.setConfig('repo_criteria_stars', `${starCriteria}`);
    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set star criteria to ${starCriteria}\n`, {flag: 'a'});
    await ctx.reply(`New star criteria set to ${starCriteria}`);
    ctx.session.stage = '';
}

export async function setCreatedCriteria(
    conversation: MyConservation,
    ctx: MyContext,
) {
    await ctx.reply(`Set created criteria as a date in format YYYY-MM-DD`);

    let createdCriteria = '';
    do {
        const newCtx = await conversation.waitFor('message:text');
        if(newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        createdCriteria = newCtx.update.message.text;
        if(!createdCriteria.match(/^\d{4}-\d{2}-\d{2}$/)) {
            await newCtx.reply('Invalid date');
            continue;
        }
        const [year, month, day] = createdCriteria.split('-').map(n => parseInt(n));
        if(year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
            await newCtx.reply('Invalid date');
            continue;
        }
        ctx = newCtx;
        break;
    } while(true)

    if(ctx.session.stage == 'set_issue_created_criteria') {
        await db.setConfig('issue_criteria_created', `${createdCriteria}`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set issue created criteria to ${createdCriteria}\n`, {flag: 'a'});
        await ctx.reply(`New issue created criteria set to ${createdCriteria}`);
    } else if(ctx.session.stage == 'set_repo_created_criteria') {
        await db.setConfig('repo_criteria_created', `${createdCriteria}`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set repo created criteria to ${createdCriteria}\n`, {flag: 'a'});
        await ctx.reply(`New repo created criteria set to ${createdCriteria}`);
    } else {
        await ctx.reply('Something went wrong');
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Wrong stage for setting created date: ${ctx.session.stage}\n`, {flag: 'a'});
        return;
    }
    ctx.session.stage = '';
}

export async function setIssuePerRepo(
    conversation: MyConservation,
    ctx: MyContext,
) {
    ctx.session.stage = 'set_issue_per_repo';
    await ctx.reply(`Set issue per repo as a number from 1 to 3`);

    let issuePerRepo = 0;
    do {
        const newCtx = await conversation.waitFor('message:text');
        if(newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        issuePerRepo = parseInt(newCtx.update.message.text);
        if(isNaN(issuePerRepo) || issuePerRepo < 1 || issuePerRepo > 3) {
            await newCtx.reply('Invalid number');
            continue;
        }

        ctx = newCtx;
        break;
    } while(true)

    await db.setConfig('issue_per_repo', `${issuePerRepo}`);
    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set issue per repo to ${issuePerRepo}\n`, {flag: 'a'});
    await ctx.reply(`New issue per repo set to ${issuePerRepo}`);
    ctx.session.stage = '';
}

export async function setHoursToSend(
    conversation: MyConservation,
    ctx: MyContext,
) {
    await ctx.reply(`Send a number from 0 to 23`);
    let hour = 0;
    do {
        const newCtx = await conversation.waitFor('message:text');
        if (newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        hour = parseInt(newCtx.update.message.text);
        if (isNaN(hour) || hour < 0 || hour > 23) {
            await newCtx.reply('Invalid number');
            continue;
        }
        const isExist = await db.isHourExists(hour);
        if(ctx.session.stage == 'add_hours_to_send') {
            if(isExist) {
                await newCtx.reply('This hour is already exists');
                continue;
            }
            await db.addHour(hour);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Add hour ${hour}\n`, {flag: 'a'});
            await newCtx.reply('Added');
        } else if(ctx.session.stage == 'remove_hours_to_send') {
            if(!isExist) {
                await newCtx.reply('This hour is not exists');
                continue;
            }
            await db.removeHour(hour);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Remove hour ${hour}\n`, {flag: 'a'});
            await newCtx.reply('Removed');
        } else {
            await ctx.reply('Something went wrong');
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Wrong stage for changing sending hours: ${ctx.session.stage}\n`, {flag: 'a'});
            ctx.session.stage = '';
            return;
        }
        ctx = newCtx;
        break;
    } while (true)
    ctx.session.stage = '';
}

export async function setServiceChatId(
    conversation: MyConservation,
    ctx: MyContext,
) {
    ctx.session.stage = 'set_service_chat_id';
    await ctx.reply(`Send service chat id`);

    let serviceChatId = '';
    do {
        const newCtx = await conversation.waitFor('message:text');
        if(newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        serviceChatId = newCtx.update.message.text;
        if(!serviceChatId.match(/^-?\d+$/)) {
            await newCtx.reply('Invalid id');
            continue;
        }
        ctx = newCtx;
        break;
    } while(true)

    await db.setConfig('service_chat_id', `${serviceChatId}`);
    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set service chat id to ${serviceChatId}\n`, {flag: 'a'});
    await ctx.reply(`New service chat id set to ${serviceChatId}`);
    ctx.session.stage = '';
}

export async function setTopic(
    conversation: MyConservation,
    ctx: MyContext,
) {
    await ctx.reply(`Send topic`);

    let topic = '';
    const newCtx = await conversation.waitFor('message:text');
    if(newCtx.update.message.text === '/cancel') {
        await newCtx.reply('Canceled');
        newCtx.session.stage = '';
        return;
    }

    topic = newCtx.update.message.text;
    ctx = newCtx;

    if(ctx.session.stage == 'set_overall_topic') {
        await db.setConfig('overall_topic', `${topic}`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set overall topic to ${topic}\n`, {flag: 'a'});
        await ctx.reply(`New overall topic set to ${topic}`);
    } else if(ctx.session.stage == 'set_ton_topic') {
        await db.setConfig('ton_topic', `${topic}`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Set ton topic to ${topic}\n`, {flag: 'a'});
        await ctx.reply(`New ton topic set to ${topic}`);
    } else {
        await ctx.reply('Something went wrong');
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Wrong stage for setting topic: ${ctx.session.stage}\n`, {flag: 'a'});
        ctx.session.stage = '';
        return;
    }
    ctx.session.stage = '';
}

export async function changeTGGroup(
    conversation: MyConservation,
    ctx: MyContext,
) {
    await ctx.reply(`Send chat id`);
    do {
        const newCtx = await conversation.waitFor('message:text');
        if (newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        const groupId = parseInt(newCtx.update.message.text);
        if (isNaN(groupId)) {
            await newCtx.reply('Invalid id');
            return;
        }
        const groups = await db.getTelegramGroups();
        ctx = newCtx;
        if (ctx.session.stage == 'add_tg_group') {
            if (groups.includes(groupId)) {
                await ctx.reply('This chat is already exists');
                continue;
            }
            try {
                await bot.bot.api.getChat(groupId);
                await db.addTelegramGroup(groupId);
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Add tg group ${groupId}\n`, {flag: 'a'});
                await ctx.reply('Added');
            } catch (e) {
                await ctx.reply('This chat is not exists');
                continue;
            }
        } else if (ctx.session.stage == 'remove_tg_group') {
            if (!groups.includes(groupId)) {
                await ctx.reply('This chat is not exists');
                continue;
            }
            await db.removeTelegramGroup(groupId);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Remove tg group ${groupId}\n`, {flag: 'a'});
            await ctx.reply('Removed');
        } else {
            await ctx.reply('Something went wrong');
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Wrong stage for changing tg group: ${ctx.session.stage}\n`, {flag: 'a'});
            ctx.session.stage = '';
            return;
        }
        break;
    } while(true)

    ctx.session.stage = '';
}

export async function changeDiscordChannel(
    conversation: MyConservation,
    ctx: MyContext,
) {
    await ctx.reply(`Send channel id`);
    do {
        const newCtx = await conversation.waitFor('message:text');
        if (newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        const channelId = newCtx.update.message.text;
        if (isNaN(parseInt(channelId))) {
            await newCtx.reply('Invalid id');
            return;
        }
        const channels = await db.getDiscordChannels();
        ctx = newCtx;
        if (ctx.session.stage == 'add_discord_channel') {
            if (channels.includes(channelId)) {
                await ctx.reply('This channel is already exists');
                continue;
            }
            try {
                const channel = await discord.client.channels.fetch(channelId);
                if(channel.isText()) {
                    await db.addDiscordChannel(channelId);
                    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Add discord group ${channelId}\n`, {flag: 'a'});
                    await ctx.reply('Added');
                } else {
                    await ctx.reply('This channel is not a text channel');
                    continue;
                }
            } catch (e) {
                await ctx.reply('This channel is not exists');
                continue;
            }
        } else if (ctx.session.stage == 'remove_discord_channel') {
            if (!channels.includes(channelId)) {
                await ctx.reply('This channel is not exists');
                continue;
            }
            await db.removeDiscordChannel(channelId);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Remove discord group ${channelId}\n`, {flag: 'a'});
            await ctx.reply('Removed');
        } else {
            await ctx.reply('Something went wrong');
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Wrong stage for changing discord group: ${ctx.session.stage}\n`, {flag: 'a'});
            ctx.session.stage = '';
            return;
        }
        break;
    } while(true)

    ctx.session.stage = '';
}

export async function changeAdmin(
    conversation: MyConservation,
    ctx: MyContext,
) {
    await ctx.reply(`Send user id`);
    do {
        const newCtx = await conversation.waitFor('message:text');
        if (newCtx.update.message.text === '/cancel') {
            await newCtx.reply('Canceled');
            newCtx.session.stage = '';
            return;
        }

        const userID = parseInt(newCtx.update.message.text);
        if (isNaN(userID)) {
            await newCtx.reply('Invalid id');
            return;
        }
        const isExists = await db.isUserExists(userID);
        if(!isExists) {
            await newCtx.reply('This user is not exists');
            continue;
        }
        ctx = newCtx;
        if (ctx.session.stage == 'add_admin') {
            await db.makeAdmin(userID);
        } else if (ctx.session.stage == 'remove_admin') {
            await db.removeAdmin(userID);
        } else {
            await ctx.reply('Something went wrong');
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Wrong stage for changing tg group: ${ctx.session.stage}\n`, {flag: 'a'});
            ctx.session.stage = '';
            return;
        }
        break;
    } while(true)

    ctx.session.stage = '';
}