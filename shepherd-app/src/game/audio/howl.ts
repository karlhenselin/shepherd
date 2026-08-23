let ctx: AudioContext | null = null;
let looping = false;
let nextTimer: ReturnType<typeof setTimeout> | null = null;
const voices: OscillatorNode[] = [];

export function startHowling (): void {
    if (looping) {
        return;
    }

    looping = true;
    howlSoon(200);
}

export function stopHowling (): void {
    looping = false;

    if (nextTimer !== null) {
        clearTimeout(nextTimer);
        nextTimer = null;
    }

    while (voices.length > 0) {
        const osc = voices.pop();
        try {
            osc?.stop();
        }
        catch {
            // already stopped
        }
    }
}

function howlSoon (delay: number): void {
    if (!looping) {
        return;
    }

    nextTimer = setTimeout(() => {
        nextTimer = null;
        cry();
        howlSoon(2200 + Math.random() * 1800);
    }, delay);
}

function cry (): void {
    if (!looping) {
        return;
    }

    const audio = context();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(620, now + 0.7);
    osc.frequency.linearRampToValueAtTime(290, now + 2.2);

    filter.type = 'bandpass';
    filter.frequency.value = 680;
    filter.Q.value = 4;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.25);
    gain.gain.linearRampToValueAtTime(0.05, now + 1.1);
    gain.gain.linearRampToValueAtTime(0, now + 2.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 2.5);
    voices.push(osc);
    osc.onended = () => {
        const i = voices.indexOf(osc);
        if (i >= 0) {
            voices.splice(i, 1);
        }
    };
}

function context (): AudioContext {
    if (!ctx) {
        ctx = new AudioContext();
    }

    if (ctx.state === 'suspended') {
        void ctx.resume();
    }

    return ctx;
}
