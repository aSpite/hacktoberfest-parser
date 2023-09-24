import {MyContext} from "./bot";
import {NextFunction} from "grammy";
import {db} from "../../index";

export const onlyPrivate =
    <T extends MyContext>(errorHandler?: (ctx: T) => unknown) =>
        (ctx: T, next: NextFunction) => {
            if (ctx.chat?.type === 'private') {
                return next();
            }
            return errorHandler?.(ctx);
        };

export const onlyAdmin =
    <T extends MyContext>(errorHandler?: (ctx: T) => unknown) =>
        async (ctx: T, next: NextFunction) => {
            if (!ctx.chat) {
                return
            }
            if (!ctx.from?.id) {
                return
            }
            if(ctx.update.message.text === '/start') {
                return next();
            }

            const admins = await db.getAdmins()
            if(admins.includes(ctx.from.id)) return next()
            else return errorHandler?.(ctx)
        }