import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePlayer } from "./playerStore";

const reset = () =>
  usePlayer.setState({
    currentStationId: null,
    isPlaying: false,
    progress: 0,
    selectedStationId: null,
  });

beforeEach(reset);
afterEach(reset);

describe("playerStore", () => {
  it("starts unmounted (currentStationId null, isPlaying false)", () => {
    const s = usePlayer.getState();
    expect(s.currentStationId).toBeNull();
    expect(s.isPlaying).toBe(false);
    expect(s.progress).toBe(0);
  });

  it("play(id) locks station + sets playing + resets progress", () => {
    usePlayer.setState({ progress: 0.42 });
    usePlayer.getState().play("brooklyn_887");
    const s = usePlayer.getState();
    expect(s.currentStationId).toBe("brooklyn_887");
    expect(s.isPlaying).toBe(true);
    expect(s.progress).toBe(0);
  });

  it("play() with the same id keeps progress (resume)", () => {
    usePlayer.getState().play("brooklyn_887");
    usePlayer.getState().setProgress(0.5);
    usePlayer.getState().pause();
    usePlayer.getState().play("brooklyn_887");
    const s = usePlayer.getState();
    expect(s.isPlaying).toBe(true);
    expect(s.progress).toBe(0.5);
  });

  it("toggle() flips isPlaying", () => {
    usePlayer.getState().play("x");
    usePlayer.getState().toggle();
    expect(usePlayer.getState().isPlaying).toBe(false);
    usePlayer.getState().toggle();
    expect(usePlayer.getState().isPlaying).toBe(true);
  });

  it("stop() clears station + flags", () => {
    usePlayer.getState().play("x");
    usePlayer.getState().stop();
    const s = usePlayer.getState();
    expect(s.currentStationId).toBeNull();
    expect(s.isPlaying).toBe(false);
    expect(s.progress).toBe(0);
  });

  it("setProgress clamps to [0, 1]", () => {
    usePlayer.getState().setProgress(-1);
    expect(usePlayer.getState().progress).toBe(0);
    usePlayer.getState().setProgress(2);
    expect(usePlayer.getState().progress).toBe(1);
    usePlayer.getState().setProgress(0.3);
    expect(usePlayer.getState().progress).toBe(0.3);
  });

  it("select(id) sets selectedStationId without touching playback", () => {
    usePlayer.getState().play("a");
    usePlayer.getState().select("b");
    const s = usePlayer.getState();
    expect(s.selectedStationId).toBe("b");
    expect(s.currentStationId).toBe("a");
    expect(s.isPlaying).toBe(true);
  });

  it("closePanel clears selection without touching playback", () => {
    usePlayer.getState().play("a");
    usePlayer.getState().select("b");
    usePlayer.getState().closePanel();
    const s = usePlayer.getState();
    expect(s.selectedStationId).toBeNull();
    expect(s.currentStationId).toBe("a");
    expect(s.isPlaying).toBe(true);
  });
});
