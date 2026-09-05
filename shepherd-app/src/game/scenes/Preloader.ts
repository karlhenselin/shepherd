import { Scene } from 'phaser';
import { loadHowlSounds } from '../audio/howl';
import { loadCueSounds } from '../audio/cues';
import { loadSheepSounds } from '../audio/sheepSounds';
import { prepareThornArt } from '../world/Thorns';
import { prepareShepherdArt } from '../entities/shepherdArt';

let assetsReady = false;
let readyWaiters: Array<() => void> = [];

export function whenAssetsReady (): Promise<void> {
    if (assetsReady) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        readyWaiters.push(resolve);
    });
}

function markAssetsReady (): void {
    assetsReady = true;
    const waiters = readyWaiters;
    readyWaiters = [];
    for (const resolve of waiters) {
        resolve();
    }
}

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        // Run under IntroScene without covering it.
        this.cameras.main.setVisible(false);
        this.input.enabled = false;
    }

    preload ()
    {
        if (assetsReady || this.textures.exists('shepherd')) {
            return;
        }

        this.load.setPath('assets');

        this.load.image('sheep', 'sheep.png');
        this.load.image('sheepfold', 'sheepfold.png');
        this.load.image('wolf', 'wolf.png');
        this.load.image('wolf-lying', 'wolf-lying.png');
        this.load.image('lion', 'lion.png');
        this.load.image('lion-lying', 'lion-lying.png');
        this.load.image('jerusalem', 'jerusalem.png');
        this.load.image('thorns-roses', 'thorns-roses.png');
        this.load.image('shepherd', 'shepherd.png');
        this.load.image('shepherd-staff', 'shepherd-staff.png');
        this.load.image('shepherd-white', 'shepherd-white.png');
        this.load.image('shepherd-staff-white', 'shepherd-staff-white.png');
        this.load.image('shepherd-kneel', 'shepherd-kneel.png');
        this.load.image('shepherd-kneel-staff', 'shepherd-kneel-staff.png');
        this.load.image('shepherd-kneel-white', 'shepherd-kneel-white.png');
        this.load.image('shepherd-kneel-staff-white', 'shepherd-kneel-staff-white.png');
        this.load.image('water-source', 'water.png');
        this.load.image('thorns', 'thorns.png');
        this.load.image('grass-tuft', 'grass-tuft.png');
        this.load.image('grass-eat-1', 'grass-eat-1.png');
        this.load.image('grass-eat-2', 'grass-eat-2.png');
        this.load.image('grass-eat-3', 'grass-eat-3.png');
        this.load.image('grass-eaten', 'grass-eaten.png');
        this.load.image('picnic', 'picnic.png');
        this.load.image('shade-tree', 'shade-tree.png');
        this.load.image('treasure-chest', 'treasure-chest.png');
        this.load.audio('exhale', 'audio/exhale.mp3');
        this.load.audio('wanderlust', 'music/wanderlust-justin-lee-main-version-29117-01-40.mp3');
        this.load.audio('wonders-of-nature', 'music/wonders-of-nature-roger-gabalda-main-version-01-31-11044.mp3');
        this.load.audio('earth-in-bloom', 'music/earth-in-bloom-richard-bodgers-main-version-00-59-7489.mp3');
        loadSheepSounds(this.load);
        loadHowlSounds(this.load);
        loadCueSounds(this.load);
    }

    create ()
    {
        if (!assetsReady) {
            knockOutNearBlack(this, 'wolf');
            knockOutNearBlack(this, 'wolf-lying');
            knockOutNearBlack(this, 'lion');
            knockOutNearBlack(this, 'lion-lying');
            knockOutNearBlack(this, 'jerusalem');
            knockOutNearBlack(this, 'thorns-roses');
            prepareThornArt(this);
            prepareShepherdArt(this);
            trimTransparentPadding(this, 'wolf');
            trimTransparentPadding(this, 'wolf-lying');
            trimTransparentPadding(this, 'lion');
            trimTransparentPadding(this, 'lion-lying');
            markAssetsReady();
        }

        this.scene.stop();
    }
}

/** Generated sprites sit on matte black; turn that field transparent. */
function knockOutNearBlack (scene: Scene, key: string, threshold = 10): void {
    if (!scene.textures.exists(key)) {
        return;
    }

    const texture = scene.textures.get(key);
    const src = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        return;
    }

    ctx.drawImage(src, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = image.data;

    for (let i = 0; i < px.length; i += 4) {
        if (px[i] <= threshold && px[i + 1] <= threshold && px[i + 2] <= threshold) {
            px[i + 3] = 0;
        }
    }

    ctx.putImageData(image, 0, 0);
    scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
}

/** Crop empty padding so paws sit at the bottom of the texture. */
function trimTransparentPadding (scene: Scene, key: string, pad = 8): void {
    if (!scene.textures.exists(key)) {
        return;
    }

    const texture = scene.textures.get(key);
    const src = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const width = src.width;
    const height = src.height;
    const read = document.createElement('canvas');
    read.width = width;
    read.height = height;
    const readCtx = read.getContext('2d');

    if (!readCtx) {
        return;
    }

    readCtx.drawImage(src, 0, 0);
    const px = readCtx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (px[(y * width + x) * 4 + 3] < 24) {
                continue;
            }

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (maxX < minX || maxY < minY) {
        return;
    }

    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return;
    }

    ctx.drawImage(read, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
}
