let _current: HTMLAudioElement | null = null;

export function playExclusive(el: HTMLAudioElement): void {
  if (_current && _current !== el) {
    _current.pause();
  }
  _current = el;
  el.play();
}

export function clearCurrent(el: HTMLAudioElement): void {
  if (_current === el) _current = null;
}
