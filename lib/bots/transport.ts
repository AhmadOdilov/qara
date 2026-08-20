import "server-only";
import {
  answerCallbackQuery,
  editBotMessageMarkup,
  editBotMessageText,
  sendBotMessage,
  sendChatAction,
} from "@/lib/bots/telegram-api";

/**
 * Javoblarni yuborish yo'li.
 *
 * Webhook va polling uchun — haqiqiy Telegram API; sinov simulyatori uchun
 * javoblarni to'plab qo'yadigan variant. Marshrutlash va amal mantig'i
 * ikkalasida ham bir xil kod bo'lib qoladi, shuning uchun konstruktordagi
 * sinov jonli bot bilan bir xil natija beradi.
 */
export type EditOutcome = "edited" | "unchanged" | "unavailable";

export type BotTransport = {
  send(
    chatId: string,
    text: string,
    opts: { replyMarkup?: unknown; silent?: boolean },
  ): Promise<{ message_id: number }>;
  /**
   * Mavjud xabarni yangilaydi (§1). `"unavailable"` qaytsa chaqiruvchi
   * yangi xabar yuboradi.
   */
  edit(
    chatId: string,
    messageId: number,
    text: string,
    opts: { replyMarkup?: unknown },
  ): Promise<EditOutcome>;
  editMarkup(
    chatId: string,
    messageId: number,
    replyMarkup: unknown,
  ): Promise<EditOutcome>;
  answerCallback(callbackQueryId: string, text?: string): Promise<void>;
  typing(chatId: string): Promise<void>;
};

export function telegramTransport(token: string): BotTransport {
  return {
    send: (chatId, text, opts) => sendBotMessage(token, chatId, text, opts),
    edit: (chatId, messageId, text, opts) =>
      editBotMessageText(token, chatId, messageId, text, opts),
    editMarkup: (chatId, messageId, replyMarkup) =>
      editBotMessageMarkup(token, chatId, messageId, replyMarkup),
    answerCallback: (id, text) => answerCallbackQuery(token, id, text),
    typing: (chatId) => sendChatAction(token, chatId, "typing"),
  };
}

export type CapturedReply = {
  text: string;
  keyboard: unknown;
  /// Yangi xabarmi yoki mavjudining tahriri
  mode: "send" | "edit";
  messageId: number;
};

export type CaptureTransport = BotTransport & {
  replies: CapturedReply[];
  toasts: string[];
};

/**
 * Tarmoqqa chiqmaydigan transport: javoblarni ro'yxatga yig'adi.
 *
 * Tahrirlash ham haqiqiy Telegram kabi ishlaydi — mavjud xabar ustiga
 * yoziladi. Shu sababli «ichma-ich menyu bitta xabarda yuradi» degan xatti-
 * harakatni sinovda tekshirib bo'ladi.
 */
export function captureTransport(): CaptureTransport {
  const replies: CapturedReply[] = [];
  const toasts: string[] = [];
  let nextId = 1;

  return {
    replies,
    toasts,
    async send(_chatId, text, opts) {
      const messageId = nextId++;
      replies.push({ text, keyboard: opts.replyMarkup ?? null, mode: "send", messageId });
      return { message_id: messageId };
    },
    async edit(_chatId, messageId, text, opts) {
      const target = replies.find((reply) => reply.messageId === messageId);
      if (!target) return "unavailable";
      target.text = text;
      target.keyboard = opts.replyMarkup ?? null;
      target.mode = "edit";
      return "edited";
    },
    async editMarkup(_chatId, messageId, replyMarkup) {
      const target = replies.find((reply) => reply.messageId === messageId);
      if (!target) return "unavailable";
      target.keyboard = replyMarkup ?? null;
      target.mode = "edit";
      return "edited";
    },
    async answerCallback(_id, text) {
      if (text) toasts.push(text);
    },
    async typing() {},
  };
}
