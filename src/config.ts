export const CONFIG_DEFAULT_VALUES = {
    repo_criteria_stars: '1000',
    repo_criteria_created: '2021-01-01',
    issue_criteria_created: '2021-01-01',
    overall_topic: 'hacktoberfest',
    ton_topic: 'hack-ton-berfest',
    hours_to_send: '16',
    service_chat_id: '0',
    last_sent: '1690000000',
    issue_per_repo: '1'
}

export const LOG_PREFIXES = {
    database: 'database',
    parser: 'parser',
    parser_overall: 'parser - overall',
    parser_ton: 'parser - ton',
    tg_bot: 'telegram',
    discord_bot: 'discord'
}

export const LOG_TYPES = {
    info: 'info',
    warning: 'warning',
    error: 'error'
}