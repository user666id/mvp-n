# Brand assets

Source images for the project's identity. Versioned here so the originals are
not lost; **placing a file here does not change anything live by itself** — see
how to apply each one below.

| File | What it is | How to apply it live |
| --- | --- | --- |
| `bot-avatar.png` | The Telegram **bot photo** — the round icon shown next to the bot name (incl. in the Mini App header and the chat list). | Set in **@BotFather** (not from code): `/mybots → @mvp_n_net_bot → Edit Bot → Edit Botpic` → upload. Square PNG, ≥ 512×512. |
| `mini-app-icon.png` | Optional dedicated **Mini App icon** (if you want it to differ from the bot photo). | **@BotFather** → `Bot Settings → Configure Mini App → App icon`. Square PNG, 512×512. |
| `logo.svg` | The **in-app logo** (the shield on the sign-in screen and in About). | This one *is* code — it lives in [`frontend/src/components/Logo.tsx`](../frontend/src/components/Logo.tsx). Drop the new vector here and update that component to render it. |

Notes
- The bot/Mini-App avatars are owned by Telegram and can only be changed through
  @BotFather by an account that controls the bot — they cannot be pushed from
  this repo or set by the API on a normal bot.
- Keep originals lossless (PNG/SVG); export the 512×512 square that BotFather
  expects from the original here.
