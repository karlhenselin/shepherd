export type Point = { x: number; y: number };

export type Wash = {
    x: number;
    y: number;
    rx: number;
    ry: number;
    color: string;
    sides: number;
};

export function paintWashes (
    ctx: CanvasRenderingContext2D,
    washes: Wash[],
    rng: () => number,
    alpha: number,
    layers = 10
): void {
    for (const blob of washes) {
        paintWash(ctx, blob, rng, alpha, layers);
    }
}

export function paintWash (
    ctx: CanvasRenderingContext2D,
    blob: Wash,
    rng: () => number,
    alpha: number,
    layers = 10
): void {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const cx = blob.x * width;
    const cy = blob.y * height;
    const rx = blob.rx * width;
    const ry = blob.ry * height;
    const base = deformPolygon(ellipsePolygon(cx, cy, rx, ry, blob.sides), 5, 22, rng);

    for (let i = 0; i < layers; i++) {
        const layer = deformPolygon(base, 4, 12, rng);
        ctx.fillStyle = hexToRgba(blob.color, alpha);
        drawPolygon(ctx, layer);
    }
}

export function addPaperGrain (ctx: CanvasRenderingContext2D, rng: () => number): void {
    const { width, height } = ctx.canvas;
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;

    for (let i = 0; i < data.length; i += 4) {
        const n = (rng() - 0.5) * 16;
        data[i] = clamp(data[i] + n);
        data[i + 1] = clamp(data[i + 1] + n);
        data[i + 2] = clamp(data[i + 2] + n);
    }

    ctx.putImageData(image, 0, 0);
}

export function mulberry32 (seed: number): () => number {
    let t = seed >>> 0;

    return () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function ellipsePolygon (cx: number, cy: number, rx: number, ry: number, sides: number): Point[] {
    const points: Point[] = [];

    for (let i = 0; i < sides; i++) {
        const t = (i / sides) * Math.PI * 2;
        points.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
    }

    return points;
}

function deformPolygon (points: Point[], depth: number, variance: number, rng: () => number): Point[] {
    let current = points.map((p) => ({ ...p }));

    for (let d = 0; d < depth; d++) {
        const next: Point[] = [];
        const spread = variance / (d + 1);

        for (let i = 0; i < current.length; i++) {
            const a = current[i];
            const c = current[(i + 1) % current.length];
            const mx = (a.x + c.x) / 2;
            const my = (a.y + c.y) / 2;
            next.push(a);
            next.push({
                x: mx + gaussian(rng) * spread,
                y: my + gaussian(rng) * spread
            });
        }

        current = next;
    }

    return current;
}

function drawPolygon (ctx: CanvasRenderingContext2D, points: Point[]): void {
    if (points.length === 0) {
        return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();
    ctx.fill();
}

function hexToRgba (hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function gaussian (rng: () => number): number {
    const u = Math.max(rng(), 1e-6);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp (value: number): number {
    return Math.max(0, Math.min(255, value));
}
