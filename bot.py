import asyncio
import json
import os
from pathlib import Path

# Load .env if present
_env = Path(__file__).parent / '.env'
if _env.exists():
    for line in _env.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

from telegram import Update, Bot
from telegram.ext import Application, ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()]

TELEGRAM_API_BASE = os.environ.get("TG_API_BASE", "")
TELEGRAM_API_FILE = os.environ.get("TG_API_FILE", "")

bot_app = None


# ===== TELEGRAM HANDLERS =====

async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id in ADMIN_IDS:
        await update.message.reply_html(
            "Привет, админ! 👋\n\n"
            "Я бот <b>Leywin</b>. Сюда приходят заявки с сайта.\n\n"
            "Команды:\n/start — начало\n/help — помощь"
        )
    else:
        await update.message.reply_html(
            "Привет! 👋\n\n"
            "Я бот <b>Leywin</b> — студии 3D-визуализации.\n\n"
            '🌐 <a href="https://leywin.art/">Наш сайт</a>\n\n'
            "Хотите связаться с нами? Просто напишите сообщение, "
            "и мы ответим в ближайшее время."
        )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id in ADMIN_IDS:
        await update.message.reply_html(
            "<b>Команды админа:</b>\n\n"
            "/start — приветствие\n"
            "/help — помощь\n\n"
            "Заявки с сайта приходят автоматически.\n"
            "Чтобы ответить — реплайните на сообщение.\n\n"
            '🌐 <a href="https://leywin.art/">Сайт Leywin</a>'
        )
    else:
        await update.message.reply_text(
            "Просто напишите ваше сообщение, и мы передадим его команде Leywin.\n"
            "Мы ответим вам в ближайшее время!"
        )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    chat_id = update.effective_chat.id

    # Admin replying to a forwarded message
    if chat_id in ADMIN_IDS and update.message.reply_to_message:
        original = update.message.reply_to_message.text or ""
        for line in original.split("\n"):
            if line.startswith("ID: "):
                try:
                    user_id = int(line.replace("ID: ", "").strip())
                    await context.bot.send_message(
                        user_id,
                        f"💬 <b>Ответ от Leywin:</b>\n\n{update.message.text}",
                        parse_mode="HTML"
                    )
                    await update.message.reply_text("✅ Ответ отправлен.")
                except Exception:
                    await update.message.reply_text("❌ Не удалось отправить.")
                return
        return

    # Regular user -> forward to admins
    if chat_id not in ADMIN_IDS:
        user = update.effective_user
        name = user.first_name + (f" {user.last_name}" if user.last_name else "")
        username = f"@{user.username}" if user.username else "нет username"

        text = (
            f"📩 <b>Новое сообщение</b>\n\n"
            f"От: <b>{name}</b> ({username})\n"
            f"ID: {chat_id}\n\n"
            f"{update.message.text}"
        )

        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(admin_id, text, parse_mode="HTML")
            except Exception:
                pass

        await update.message.reply_text("Ваше сообщение отправлено! Мы ответим вам в ближайшее время. ✅")


# ===== HTTP SERVER (receives notifications from Node.js) =====

from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

HTTP_PORT = 3001

class NotifyHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            email = data.get("email", "")
            if email:
                text = (
                    f"📧 <b>Новая заявка с сайта</b>\n\n"
                    f"Email: <code>{email}</code>\n\n"
                    f'Клиент оставил email для связи на <a href="https://leywin.art/">Leywin</a>'
                )
                bot = Bot(
                    token=BOT_TOKEN,
                    base_url=TELEGRAM_API_BASE if TELEGRAM_API_BASE else None,
                    base_file_url=TELEGRAM_API_FILE if TELEGRAM_API_FILE else None,
                )
                loop = asyncio.new_event_loop()
                for admin_id in ADMIN_IDS:
                    try:
                        loop.run_until_complete(
                            bot.send_message(admin_id, text, parse_mode="HTML")
                        )
                    except Exception as e:
                        print(f"Failed to notify {admin_id}: {e}")
                loop.close()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, format, *args):
        pass


def run_http_server():
    server = HTTPServer(("127.0.0.1", HTTP_PORT), NotifyHandler)
    print(f"  Bot HTTP listener on port {HTTP_PORT}")
    server.serve_forever()


# ===== MAIN =====

def main():
    print("  Leywin Telegram bot starting...")

    # Start HTTP server in a thread
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()

    # Build bot with custom API URL if set
    builder = ApplicationBuilder().token(BOT_TOKEN)
    if TELEGRAM_API_BASE:
        builder = builder.base_url(TELEGRAM_API_BASE).base_file_url(TELEGRAM_API_FILE)

    global bot_app
    bot_app = builder.build()
    bot_app.add_handler(CommandHandler("start", start_cmd))
    bot_app.add_handler(CommandHandler("help", help_cmd))
    bot_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("  Leywin Telegram bot started OK")
    bot_app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
