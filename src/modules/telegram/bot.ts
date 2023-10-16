import {Bot, Context, GrammyError, HttpError, lazySession, SessionFlavor} from "grammy";
import {Conversation, ConversationFlavor, conversations, createConversation} from "@grammyjs/conversations";
import fs from "fs";
import {LOG_PREFIXES, LOG_TYPES} from "../../config";
import {onlyAdmin, onlyPrivate} from "./bot.middlewares";
import {
    changeAdmin,
    changeDiscordChannel,
    changeTGGroup,
    setCreatedCriteria,
    setHoursToSend,
    setIssuePerRepo,
    setServiceChatId,
    setStarCriteria, setTopic
} from "./bot.conversations";
import {MyDatabase} from "../../db/database";
import { run } from '@grammyjs/runner';
import {getCurrentTimeFormatted} from "../../utils/utils";
import {db} from "../../index";
import {parseIssues} from "../parser";

interface SessionData {
    stage: string;
}

export type MyContext = Context &
    SessionFlavor<SessionData> &
    ConversationFlavor & {
    db: MyDatabase;
};
export type MyConservation = Conversation<MyContext>;

function initial(): SessionData {
    return {
        stage: ''
    };
}

export class MyBot {
    readonly bot: Bot<MyContext>;
    constructor() {
        this.bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN);
        this.bot.use(lazySession({
            initial
        }));

        this.bot.catch((err) => {
            const ctx = err.ctx;
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Error while handling update ${ctx.update.update_id}:\n`, {flag: 'a'});
            const e = err.error;
            if (e instanceof GrammyError) {
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Error in request: ${e.description}\n`, {flag: 'a'});
            } else if (e instanceof HttpError) {
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Could not contact Telegram: ${e}\n`, {flag: 'a'});
            } else {
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.error}]: Unknown error: ${e}\n`, {flag: 'a'});
            }
        });
        this.bot.use(onlyPrivate());
        this.bot.use(onlyAdmin());
        this.bot.use(conversations());
        this.bot.use(createConversation(setStarCriteria, 'set_star_criteria'));
        this.bot.use(createConversation(setCreatedCriteria, 'set_created_criteria'));
        this.bot.use(createConversation(setIssuePerRepo, 'set_issue_per_repo'));
        this.bot.use(createConversation(setHoursToSend, 'set_hours_to_send'));
        this.bot.use(createConversation(setServiceChatId, 'set_service_chat_id'));
        this.bot.use(createConversation(setTopic, 'set_topic'));
        this.bot.use(createConversation(changeTGGroup, 'change_tg_group'));
        this.bot.use(createConversation(changeDiscordChannel, 'change_discord_channel'));
        this.bot.use(createConversation(changeAdmin, 'change_admin'))
        this.bot.command('start', async (ctx) => {
            await ctx.replyWithAnimation('CgACAgIAAxkBAAONZS2OW3EgdAQ4Gn2s_FPqP6j_Jg8AAgM-AAJDm3BJtmI0Vik6cdUwBA', {
                    caption: `👋 Hello, ${ctx.from.first_name}! I'm Hacktoberfest 2023 bot.`
                }
            )
            const user = await db.isUserExists(ctx.from.id);
            if(!user) {
                await db.addUser(ctx.from.id);
            }
        });

        this.bot.on('message:animation', async ctx => {
            console.log(ctx.message.animation)
            await ctx.reply(`ID: ${ctx.message.animation.file_id}`);
        });
        this.bot.command('config', async ctx => {
            const config = await db.getConfig();
            await ctx.reply(`⚙️ <b>Current config</b>:

<b>Star criteria</b>: ${config.repoCriteriaStars}
<b>Created criteria</b>: ${config.repoCriteriaCreated}
<b>Issue created criteria</b>: ${config.issueCriteriaCreated}
<b>Issue per repo</b>: ${config.issuePerRepo}
<b>Hours to send</b>: ${config.hoursToSend.join(', ')}
<b>Service chat ID</b>: ${config.serviceChatID}
<b>Overall topic</b>: ${config.overallTopic}
<b>TON topic</b>: ${config.tonTopic}`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Set star criteria', callback_data: 'set_star_criteria'},
                            {text: 'Set created criteria', callback_data: 'set_repo_created_criteria'}
                        ],
                        [
                            {text: 'Set issue created criteria', callback_data: 'set_issue_created_criteria'},
                            {text: 'Set issue per repo', callback_data: 'set_issue_per_repo'}
                        ],
                        [
                            {text: 'Change hours to send', callback_data: 'set_hours_to_send'},
                            {text: 'Set service chat ID', callback_data: 'set_service_chat_id'}
                        ],
                        [
                            {text: 'Set overall topic', callback_data: 'set_overall_topic'},
                            {text: 'Set TON topic', callback_data: 'set_ton_topic'}
                        ]
                    ]
                },
                parse_mode: 'HTML'
            });
        });
        this.bot.command('tg_groups', async ctx => {
            let message = '📚 <b>Telegram groups</b>:\n\n';
            const groups = await db.getTelegramGroups();
            for(let index = 0; index < groups.length; index++) {
                try {
                    const group = await this.bot.api.getChat(groups[index]);
                    if(group.type === 'supergroup' || group.type === 'group') {
                        message += `<b>${index + 1}</b>. ${group.title} 
<b>ID</b>: ${groups[index]}\n\n`;
                    } else {
                        message += `<b>${index + 1}</b>. Not group
<b>ID</b>: ${groups[index]}\n\n`;
                    }
                } catch (e) {
                    message += `<b>${index + 1}</b>. ❌ Chat not found: ${groups[index]}\n\n`;
                }
            }
            await ctx.reply(message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Add', callback_data: 'add_tg_group'},
                            {text: 'Remove', callback_data: 'remove_tg_group'}
                        ]
                    ]
                },
                parse_mode: 'HTML'
            });
        });

        this.bot.command('discord_channels', async ctx => {
            let message = '📚 <b>Discord channels</b>:\n\n';
            const channels = await db.getDiscordChannels();
            for(let index = 0; index < channels.length; index++)
                message += `<b>${index + 1}</b>. ${channels[index]}\n\n`;

            await ctx.reply(message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Add', callback_data: 'add_discord_channel'},
                            {text: 'Remove', callback_data: 'remove_discord_channel'}
                        ]
                    ]
                },
                parse_mode: 'HTML'
            });
        });

        this.bot.command('parse', async ctx => {
            await ctx.reply('Parsing started');
            await parseIssues(db, true, ctx.from.id);
        });

        this.bot.command('admins', async ctx => {
            const admins = await db.getAdmins();
            let message = '👮 <b>Admins</b>:\n\n';
            for(let index = 0; index < admins.length; index++) {
                const admin = await this.bot.api.getChat(admins[index]);
                if(admin.type === 'private')
                    message += `<b>${index + 1}</b>. ${admin.first_name}
ID: ${admins[index]}\n\n`;
            }

            await ctx.reply(message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Add', callback_data: 'add_admin'},
                            {text: 'Remove', callback_data: 'remove_admin'}
                        ]
                    ]
                },
                parse_mode: 'HTML'
            });
        })

        this.bot.on('callback_query:data', async ctx => {
            if(ctx.session.stage !== '') {
                await ctx.answerCallbackQuery({
                    text: 'You are already changing some config. Cancel it or finish it first',
                    show_alert: true
                });
                return;
            }
            await ctx.answerCallbackQuery();
            const data = ctx.callbackQuery.data;
            if(data === 'set_star_criteria') {
                await ctx.conversation.enter('set_star_criteria');
            }
            else if(data === 'set_repo_created_criteria') {
                ctx.session.stage = 'set_repo_created_criteria';
                await ctx.conversation.enter('set_created_criteria');
            }
            else if(data === 'set_issue_created_criteria') {
                ctx.session.stage = 'set_issue_created_criteria';
                await ctx.conversation.enter('set_created_criteria');
            }
            else if(data === 'set_issue_per_repo') {
                await ctx.conversation.enter('set_issue_per_repo');
            }
            else if(data === 'set_hours_to_send') {
                await ctx.reply('Choose operation: ', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {text: 'Add', callback_data: 'add_hours_to_send'},
                                {text: 'Remove', callback_data: 'remove_hours_to_send'}
                            ]
                        ]
                    }
                });
            }
            else if(data === 'add_hours_to_send') {
                ctx.session.stage = 'add_hours_to_send';
                await ctx.conversation.enter('set_hours_to_send');
            }
            else if(data === 'remove_hours_to_send') {
                ctx.session.stage = 'remove_hours_to_send';
                await ctx.conversation.enter('set_hours_to_send');
            }
            else if(data === 'set_service_chat_id') {
                await ctx.conversation.enter('set_service_chat_id');
            }
            else if(data === 'set_overall_topic') {
                ctx.session.stage = 'set_overall_topic';
                await ctx.conversation.enter('set_topic');
            }
            else if(data === 'set_ton_topic') {
                ctx.session.stage = 'set_ton_topic';
                await ctx.conversation.enter('set_topic');
            }
            else if(data === 'add_tg_group') {
                ctx.session.stage = 'add_tg_group';
                await ctx.conversation.enter('change_tg_group');
            }
            else if(data === 'remove_tg_group') {
                ctx.session.stage = 'remove_tg_group';
                await ctx.conversation.enter('change_tg_group');
            }
            else if(data === 'add_discord_channel') {
                ctx.session.stage = 'add_discord_channel';
                await ctx.conversation.enter('change_discord_channel');
            }
            else if(data === 'remove_discord_channel') {
                ctx.session.stage = 'remove_discord_channel';
                await ctx.conversation.enter('change_discord_channel');
            }
            else if(data === 'add_admin') {
                ctx.session.stage = 'add_admin';
                await ctx.conversation.enter('change_admin');
            }
            else if(data === 'remove_admin') {
                ctx.session.stage = 'remove_admin';
                await ctx.conversation.enter('change_admin');
            }
        });
    }

    async start() {
        const handle = run(this.bot);
        handle.task().then(() => {
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Bot ended\n`, {flag: 'a'});
        });
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.tg_bot}] [${LOG_TYPES.info}]: Bot started\n`, {flag: 'a'});
    }
}