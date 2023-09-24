import {Database, open} from "sqlite";
import sqlite3 from 'sqlite3';
import {ADMIN_ID, CONFIG_DEFAULT_VALUES, LOG_PREFIXES, LOG_TYPES} from "../config";
import {getCurrentTimeFormatted, sleep} from "../utils/utils";
import {Issue} from "../modules/parser";
import fs from "fs";

interface Config {
    repoCriteriaStars: number;
    repoCriteriaCreated: string;
    issueCriteriaCreated: string;
    issuePerRepo: number;
    hoursToSend: number[];
    serviceChatID: number;
    overallTopic: string;
    tonTopic: string;
    lastSent: number; // timestamp in seconds
}

export class MyDatabase {
  private db: Database;

  constructor() {}

  async init() {
      this.db = await open({
          filename: './database.db',
          driver: sqlite3.Database
      });

      const users = await this.db.get(`
            SELECT name 
            FROM sqlite_master 
            WHERE type='table' AND name='users'`);

      if(!users) {
          await this.db.run(`
          CREATE TABLE IF NOT EXISTS users
          (
              id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              telegram_id INTEGER   NOT NULL UNIQUE,
              is_admin    BOOLEAN   NOT NULL DEFAULT FALSE,
              created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`);

          await this.db.run(`
                INSERT INTO users (telegram_id, is_admin)
                VALUES ($1, $2)
            `, ADMIN_ID, true);
      }



      await this.db.run(`
          CREATE TABLE IF NOT EXISTS issues
          (
              id PRIMARY KEY,
              url        TEXT      NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`);

      // states: none, waiting_message, sent, failed
      await this.db.run(`
            CREATE TABLE IF NOT EXISTS telegram_groups
            (
                chat_id    INTEGER NOT NULL,
                state      TEXT    NOT NULL DEFAULT 'none'
            )`);

      // states: none, waiting_message, sent, failed
      await this.db.run(`
            CREATE TABLE IF NOT EXISTS discord_channels
            (
                channel_id TEXT NOT NULL,
                state      TEXT    NOT NULL DEFAULT 'none'
            )`);


      const config = await this.db.get(`
            SELECT name 
            FROM sqlite_master 
            WHERE type='table' AND name='config'`);

      if (!config) {
            await this.db.run(`
                    CREATE TABLE IF NOT EXISTS config
                    (
                        key   TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    )`);

            await this.db.run(`
                    INSERT INTO config (key, value)
                    VALUES ('repo_criteria_stars', $1),
                            ('repo_criteria_created', $2),
                            ('issue_criteria_created', $3),
                            ('hours_to_send', $4),
                            ('service_chat_id', $5),
                            ('overall_topic', $6),
                            ('ton_topic', $7),
                            ('last_sent', $8),
                            ('issue_per_repo', $9)
            `, CONFIG_DEFAULT_VALUES.repo_criteria_stars,
                CONFIG_DEFAULT_VALUES.repo_criteria_created,
                CONFIG_DEFAULT_VALUES.issue_criteria_created,
                CONFIG_DEFAULT_VALUES.hours_to_send,
                CONFIG_DEFAULT_VALUES.service_chat_id,
                CONFIG_DEFAULT_VALUES.overall_topic,
                CONFIG_DEFAULT_VALUES.ton_topic,
                CONFIG_DEFAULT_VALUES.last_sent,
                CONFIG_DEFAULT_VALUES.issue_per_repo);
      }
  }

  async getConfig() : Promise<Config> {
        const result = await this.db.all(`
                SELECT * FROM config
        `);

        return {
            repoCriteriaStars: parseInt(result.find(r => r.key === 'repo_criteria_stars')?.value),
            repoCriteriaCreated: result.find(r => r.key === 'repo_criteria_created')?.value,
            issueCriteriaCreated: result.find(r => r.key === 'issue_criteria_created')?.value,
            hoursToSend: result.find(r => r.key === 'hours_to_send')?.value.split(' ').map(h => parseInt(h)),
            serviceChatID: parseInt(result.find(r => r.key === 'service_chat_id')?.value),
            overallTopic: result.find(r => r.key === 'overall_topic')?.value,
            tonTopic: result.find(r => r.key === 'ton_topic')?.value,
            lastSent: parseInt(result.find(r => r.key === 'last_sent')?.value),
            issuePerRepo: parseInt(result.find(r => r.key === 'issue_per_repo')?.value)
        };
  }

  async setConfig(key: string, value: string) {
        await this.db.run(`
                UPDATE config
                SET value = $1
                WHERE key = $2
        `, value, key);
  }

  async isIssueExists(id: number) : Promise<boolean> {
        const result = await this.db.get(`
                SELECT * FROM issues
                WHERE id = $1
        `, id);

        return !!result;
  }

  async addIssues(issues: Issue[]) {
      const stmt = await this.db.prepare(`
            INSERT INTO issues (id, url)
            VALUES (?, ?)
      `);

      for(const issue of issues) {
          await stmt.run(issue.id, issue.url);
      }
      await stmt.finalize();
  }

  async isHourExists(hour: number) : Promise<boolean> {
        const result = await this.db.get(`
                SELECT * 
                FROM config
                WHERE key = 'hours_to_send'
        `);

        const hours = result.value.split(' ').map(h => parseInt(h));
        return hours.includes(hour);
  }

  async addHour(hour: number) {
        const result = await this.db.get(`
                SELECT * 
                FROM config
                WHERE key = 'hours_to_send'
        `);

        const hours = result.value.split(' ').map(h => parseInt(h));
        hours.push(hour);
        await this.db.run(`
                UPDATE config
                SET value = $1
                WHERE key = 'hours_to_send'
        `, hours.join(' '));
  }

  async removeHour(hour: number) {
        const result = await this.db.get(`
                SELECT * 
                FROM config
                WHERE key = 'hours_to_send'
        `);

        const hours = result.value.split(' ').map(h => parseInt(h));
        const index = hours.indexOf(hour);
        hours.splice(index, 1);
        await this.db.run(`
                UPDATE config
                SET value = $1
                WHERE key = 'hours_to_send'
        `, hours.join(' '));
  }

  async startSending() {
        await this.db.run('BEGIN TRANSACTION');
        try {
            await this.db.run(`
                UPDATE config
                SET value = $1
                WHERE key = 'last_sent'
            `, Math.floor(Date.now() / 1000));

            await this.db.run(`
                UPDATE telegram_groups
                SET state = 'waiting_msg'
            `);

            await this.db.run(`
                UPDATE discord_channels
                SET state = 'waiting_msg'
            `);

            await this.db.run('COMMIT');
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.database}] [${LOG_TYPES.info}]: Starting sending\n`, {flag: 'a'});
        } catch (e) {
            await this.db.run('ROLLBACK');
            fs.writeFileSync('logs.txt', `${getCurrentTimeFormatted()} [${LOG_PREFIXES.database}] [${LOG_TYPES.error}]: Error while starting sending: ${e}\n`, {flag: 'a'});
        }
  }

  async getTelegramTasks() : Promise<number[]> {
      const result = await this.db.all(`
                SELECT chat_id
                FROM telegram_groups
                WHERE state = 'waiting_msg'
                LIMIT 15
      `);

      return result.map(r => r.chat_id);
  }

  async getDiscordTasks() : Promise<string[]> {
        const result = await this.db.all(`
                SELECT channel_id
                FROM discord_channels
                WHERE state = 'waiting_msg'
                LIMIT 2
        `);

        return result.map(r => r.channel_id);
  }

  async handleTelegramTask(chatID: number) {
        await this.db.run(`
                UPDATE telegram_groups
                SET state = 'none'
                WHERE chat_id = $1
        `, chatID);
  }

  async handleDiscordTask(channelID: string) {
        await this.db.run(`
                UPDATE discord_channels
                SET state = 'none'
                WHERE channel_id = $1
        `, channelID);
  }

  async getTelegramGroups() : Promise<number[]> {
        const result = await this.db.all(`
                    SELECT chat_id
                    FROM telegram_groups
        `);

        return result.map(r => r.chat_id);
  }

  async getDiscordChannels() : Promise<string[]> {
      const result = await this.db.all(`
                SELECT channel_id
                FROM discord_channels
      `);

      return result.map(r => r.channel_id);
  }

    async addTelegramGroup(chatID: number) {
        await this.db.run(`
                INSERT INTO telegram_groups (chat_id)
                VALUES ($1)
        `, chatID);
    }

    async removeTelegramGroup(chatID: number) {
        await this.db.run(`
                DELETE FROM telegram_groups
                WHERE chat_id = $1
        `, chatID);
    }

    async addDiscordChannel(channelID: string) {
        await this.db.run(`
                INSERT INTO discord_channels (channel_id)
                VALUES ($1)
        `, channelID);
    }

    async removeDiscordChannel(channelID: string) {
        await this.db.run(`
                DELETE FROM discord_channels
                WHERE channel_id = $1
        `, channelID);
    }

    async getAdmins() : Promise<number[]> {
        const result = await this.db.all(`
                SELECT telegram_id
                FROM users
                WHERE is_admin = TRUE
        `);

        return result.map(r => r.telegram_id);
    }

    async addUser(telegramID: number) {
        await this.db.run(`
                INSERT INTO users (telegram_id)
                VALUES ($1)
        `, telegramID);
    }

    async isUserExists(telegramID: number) : Promise<boolean> {
        const result = await this.db.get(`
                SELECT * FROM users
                WHERE telegram_id = $1
        `, telegramID);

        return !!result;
    }

    async makeAdmin(telegramID: number) {
        await this.db.run(`
                UPDATE users
                SET is_admin = TRUE
                WHERE telegram_id = $1
        `, telegramID);
    }

    async removeAdmin(telegramID: number) {
        await this.db.run(`
                UPDATE users
                SET is_admin = FALSE
                WHERE telegram_id = $1
        `, telegramID);
    }
}