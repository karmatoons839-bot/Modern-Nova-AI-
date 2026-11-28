import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  row: { tool: "voice", output_path: "user/audio.mp3", telegram_approval_required: false, telegram_approved_at: null } as {tool:string;output_path:string|null;telegram_approval_required:boolean;telegram_approved_at:string|null},
  api: vi.fn(), download: vi.fn(), update: vi.fn(), begin: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({supabaseAdmin: {
  rpc: mocks.begin,
  from: () => ({select: () => ({eq: () => ({maybeSingle: async () => ({data:mocks.row,error:null})})}),update: mocks.update}),
  storage: {from: () => ({download:mocks.download})},
}}));
vi.mock("@/lib/telegram.server", () => ({telegramApi:mocks.api}));
vi.mock("@/lib/s2v-notify.server", () => ({S2V_NOTIFY_CHAT_ID:"-1004423710774"}));
import { forwardOne } from "./generation-forward.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = {tool:"voice",output_path:"user/audio.mp3",telegram_approval_required:false,telegram_approved_at:null};
  mocks.download.mockResolvedValue({data:new Blob(["real saved audio"])});
  mocks.api.mockResolvedValue({ok:true});
  mocks.begin.mockImplementation(async () => ({data:mocks.row.tool !== 'voice' && !(mocks.row.telegram_approval_required && !mocks.row.telegram_approved_at),error:null}));
  mocks.update.mockReturnValue({eq:vi.fn().mockResolvedValue({error:null})});
});

describe("complete voiceover Telegram forwarding", () => {
  it("already claimed dialogue fragments never send audio", async () => {
    await forwardOne("line-id");
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("sends the complete export as exactly one audio file to Admin group", async () => {
    mocks.row.tool = "voice_full";
    await forwardOne("full-id");
    expect(mocks.api).toHaveBeenCalledTimes(1);
    const [method, form] = mocks.api.mock.calls[0] ?? [];
    expect(method).toBe("sendAudio");
    expect(form.get("chat_id")).toBe("-1004423710774");
    expect(form.get("audio")).toBeInstanceOf(File);
    expect(mocks.download).toHaveBeenCalledWith("user/audio.mp3");
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it("unapproved controlled exports never send", async () => {
    mocks.row.tool = "voice_full";
    mocks.row.telegram_approval_required = true;
    await forwardOne("full-id");
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it("failed provider sends never mark the complete export delivered", async () => {
    mocks.row.tool = "voice_full";
    mocks.api.mockRejectedValue(new Error("Telegram unavailable"));
    await expect(forwardOne("full-id")).rejects.toThrow("Telegram unavailable");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'review'}));
  });
  it("missing complete audio never marks delivery successful", async () => {
    mocks.row.tool = "voice_full";
    mocks.download.mockResolvedValue({data:null});
    await expect(forwardOne("full-id")).rejects.toThrow("COMPLETE_VOICEOVER_DELIVERY_FAILED");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'review'}));
  });
  it('a repeated worker cannot send the same voiceover again', async () => {
    mocks.row.tool = 'voice_full';
    mocks.begin.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:false,error:null});
    await forwardOne('full-id');
    await forwardOne('full-id');
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });
  it('an uncertain provider outcome cannot trigger an automatic resend', async () => {
    mocks.row.tool = 'voice_full';
    mocks.begin.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:false,error:null});
    mocks.api.mockRejectedValue(new Error('Telegram timeout'));
    await expect(forwardOne('full-id')).rejects.toThrow('Telegram timeout');
    await forwardOne('full-id');
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });
});