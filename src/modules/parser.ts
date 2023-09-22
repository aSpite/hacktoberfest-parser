import fs from "fs";
import {getCurrentTimeFormatted} from "../utils/utils";
import {MyDatabase} from "../db/database";
import {Octokit} from "octokit";
import {LOG_PREFIXES, LOG_TYPES} from "../config";
import {bot} from "../index";
import {getMessage} from "./telegram/bot.worker";

export interface Issue {
    id: number,
    title: string;
    url: string;
    repo: string;
    category: string;
}

export async function parseIssues(db: MyDatabase, manually = false, chatID?: number) {
    const github = new Octokit({
        auth: process.env.GITHUB_API_TOKEN,
    });

    const issues: Issue[] = [];
    const config = await db.getConfig();
    const currentTime = new Date();
    if(!manually) {
        if(!(config.hoursToSend.includes(currentTime.getUTCHours()))) {
            return;
        }
        if(currentTime.getTime() / 1000 - config.lastSent < 3600) {
            return;
        }
    }
    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser}] [${LOG_TYPES.info}]: Starting parse issues\n`, {flag: 'a'});
    const overallRepos = await github.request('GET /search/repositories', {
        q: `topic:${config.overallTopic} stars:>=${config.repoCriteriaStars} created:<${config.repoCriteriaCreated}`,
        sort: 'updated',
        per_page: 100
    });


    for(const repo of overallRepos.data.items) {
        const overallIssues = await github.request('GET /search/issues', {
            q: `repo:${repo.full_name} is:issue is:open created:>${config.issueCriteriaCreated}`,
            sort: 'created'
        });
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_overall}] [${LOG_TYPES.info}]: Repo: ${repo.full_name}, issues: ${overallIssues.data.items.length}\n`, {flag: 'a'});

        let counter = 0;
        for (const issue of overallIssues.data.items) {
            if (await db.isIssueExists(issue.id)) {
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_overall}] [${LOG_TYPES.info}]: Issue ${issue.id} already exists\n`, {flag: 'a'});
                continue;
            }

            issues.push({
                id: issue.id,
                title: issue.title,
                url: issue.html_url,
                repo: repo.html_url,
                category: 'overall'
            });
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_overall}] [${LOG_TYPES.info}]: Issue ${issue.id} added\n`, {flag: 'a'});
            counter++;
            if (counter == config.issuePerRepo) break;
            if (issues.length == 8) break;
        }
        if (issues.length == 8) {
            await db.addIssues(issues);
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_overall}] [${LOG_TYPES.info}]: Overall issues added\n`, {flag: 'a'});
            break;
        }
    }

    if(issues.length < 8) {
        await bot.bot.api.sendMessage(config.serviceChatID, `❌ Overall issues less than 8. Aborting`);
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_overall}] [${LOG_TYPES.info}] [${LOG_TYPES.warning}]: Overall issues less than 8. Aborting\n`, {flag: 'a'});
        return;
    }

    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_ton}] [${LOG_TYPES.info}]: Starting parse issues for TON\n`, {flag: 'a'});
    const tonRepos = await github.request('GET /search/repositories', {
        // TODO: Change topic
        q: `topic:${config.overallTopic}`,
        sort: 'updated',
        per_page: 100
    });
    for(const repo of tonRepos.data.items) {
        const tonIssues = await github.request('GET /search/issues', {
            q: `repo:${repo.full_name} is:issue is:open`,
            sort: 'created'
        });
        fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_ton}] [${LOG_TYPES.info}]: Repo: ${repo.full_name}, issues: ${tonIssues.data.items.length}\n`, {flag: 'a'});

        for(const issue of tonIssues.data.items) {
            if(await db.isIssueExists(issue.id)) {
                fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_ton}] [${LOG_TYPES.info}]: Issue ${issue.id} already exists\n`, {flag: 'a'});
                continue;
            }

            issues.push({
                id: issue.id,
                title: issue.title,
                url: issue.html_url,
                repo: repo.html_url,
                category: 'ton'
            });
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_ton}] [${LOG_TYPES.info}]: Issue ${issue.id} added\n`, {flag: 'a'});
            if(issues.length == 10)
                break;
        }
        if(issues.length == 10) {
            // await db.addIssues(issues);
            break;
        }
    }

    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser_ton}] [${LOG_TYPES.info}]: TON issues added. Amount: ${issues.length - 8}\n`, {flag: 'a'});
    fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.parser}] [${LOG_TYPES.info}]: Ending parse issues\n`, {flag: 'a'});

    if(!manually) {
        fs.writeFileSync('issues.json', JSON.stringify(issues, null, 2));
        await db.startSending();
    } else {
        const message = getMessage(issues);
        await bot.bot.api.sendMessage(chatID, message, {
            parse_mode: 'HTML'
        });
    }
}