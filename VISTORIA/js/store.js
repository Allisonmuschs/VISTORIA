// useInspection(id): loads one inspection and returns [inspection, update, missing].
// update(fn) mutates a deep copy, re-renders immediately, and saves to IndexedDB after a short debounce.
import { useState, useEffect, useRef, useCallback } from './ui.js';
import { db } from './db.js';

const SAVE_DELAY = 250;
const clone = (x) => JSON.parse(JSON.stringify(x));

export function useInspection(id) {
  const [insp, setInsp] = useState(null);
  const [missing, setMissing] = useState(false);
  const cur = useRef(null);
  const timer = useRef(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (cur.current) db.put(cur.current);
    }
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    db.get(id).then((x) => {
      if (!alive) return;
      if (!x) setMissing(true);
      else {
        cur.current = x;
        setInsp(x);
      }
    });
    const onHide = () => document.hidden && flush();
    document.addEventListener('visibilitychange', onHide);
    addEventListener('pagehide', flush);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', flush);
      flush();
    };
  }, [id]);

  const update = useCallback((fn) => {
    if (!cur.current) return;
    const next = clone(cur.current);
    fn(next);
    next.updatedAt = Date.now();
    cur.current = next;
    setInsp(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      db.put(next);
    }, SAVE_DELAY);
  }, []);

  return [insp, update, missing];
}
