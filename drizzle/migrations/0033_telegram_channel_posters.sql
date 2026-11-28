ALTER TABLE public.telegram_broadcast_settings ADD COLUMN IF NOT EXISTS channel_chat_ids text[] NOT NULL DEFAULT '{}';
UPDATE public.telegram_broadcast_settings SET channel_chat_ids = ARRAY['-1004387895125'] WHERE id = true;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_broadcast_log_channel_daily ON public.telegram_broadcast_log (chat_id, kind, local_date) WHERE kind = 'channel_poster';