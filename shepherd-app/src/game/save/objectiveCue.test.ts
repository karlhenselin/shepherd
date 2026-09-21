import { describe, expect, it } from 'vitest';
import {
    followingFlock,
    hasUndiscoveredFind,
    objectiveCue,
    type ObjectiveCueState
} from './objectiveCue';

function nightState (extra: Partial<ObjectiveCueState> = {}): ObjectiveCueState {
    return {
        flock: followingFlock(),
        foundCount: 4,
        nightStarted: true,
        hasStaff: false,
        staffOnGround: false,
        heardCorinthians: false,
        heardJohn102: false,
        heardJohn109: false,
        cityOpen: false,
        gemsRemaining: true,
        waterVerseAvailable: false,
        ...extra
    };
}

describe('hasUndiscoveredFind', () => {
    it('is false when all four sheep are following', () => {
        expect(hasUndiscoveredFind(followingFlock())).toBe(false);
    });

    it('is true for an undiscovered waiting or hole sheep', () => {
        expect(hasUndiscoveredFind([
            ...followingFlock(['Clover', 'Snowball', 'Milo']),
            { name: 'Biscuit', mood: 'hurt', hurt: true, discovered: false, hungry: false, thirsty: false }
        ])).toBe(true);
    });

    it('ignores discovered wanderers', () => {
        expect(hasUndiscoveredFind([
            ...followingFlock(['Clover', 'Snowball', 'Milo']),
            { name: 'Biscuit', mood: 'waiting', hurt: false, discovered: true, hungry: false, thirsty: false }
        ])).toBe(false);
    });
});

describe('objectiveCue — night with full flock', () => {
    it('does not say find-sheep when all four are following', () => {
        expect(objectiveCue(nightState())).not.toBe('I need to find my sheep.');
        expect(objectiveCue(nightState())).toBe('I need to guide my flock to the pen.');
    });

    it('asks for the staff when it is on the ground', () => {
        expect(objectiveCue(nightState({
            staffOnGround: true,
            hasStaff: false
        }))).toBe('I need my staff.');
    });

    it('guides to the pen after the staff is equipped', () => {
        expect(objectiveCue(nightState({
            hasStaff: true,
            staffOnGround: false
        }))).toBe('I need to guide my flock to the pen.');
    });

    it('says the flock is home after the gate verse', () => {
        expect(objectiveCue(nightState({
            hasStaff: true,
            heardJohn102: true,
            heardJohn109: true
        }))).toBe('My flock is home.');
    });
});

describe('objectiveCue — day finds', () => {
    it('says find-sheep for the first lost sheep', () => {
        expect(objectiveCue({
            flock: [
                { name: 'Clover', mood: 'waiting', hurt: false, discovered: false, hungry: false, thirsty: false }
            ],
            foundCount: 0,
            nightStarted: false,
            hasStaff: false,
            staffOnGround: false,
            heardCorinthians: false,
            heardJohn102: false,
            heardJohn109: false,
            cityOpen: false,
            gemsRemaining: false,
            waterVerseAvailable: false
        })).toBe('I need to find my sheep.');
    });

    it('names a wanderer before other night quests', () => {
        expect(objectiveCue(nightState({
            flock: [
                ...followingFlock(['Clover', 'Snowball', 'Milo']),
                { name: 'Biscuit', mood: 'waiting', hurt: false, discovered: true, hungry: false, thirsty: false }
            ],
            staffOnGround: true
        }))).toBe('Biscuit wandered off—I need to find them.');
    });

    it('asks to bandage a hole sheep when discovered', () => {
        expect(objectiveCue(nightState({
            flock: [
                ...followingFlock(['Clover', 'Snowball', 'Milo']),
                {
                    name: 'Biscuit',
                    mood: 'hurt',
                    hurt: true,
                    discovered: true,
                    hungry: false,
                    thirsty: false
                }
            ]
        }))).toBe('I need to bandage Biscuit.');
    });

    it('asks to find Biscuit before discovering he is hurt', () => {
        expect(objectiveCue({
            flock: [
                ...followingFlock(['Clover', 'Snowball', 'Milo']),
                {
                    name: 'Biscuit',
                    mood: 'hurt',
                    hurt: true,
                    discovered: false,
                    hungry: false,
                    thirsty: false
                }
            ],
            foundCount: 3,
            nightStarted: false,
            hasStaff: false,
            staffOnGround: false,
            heardCorinthians: false,
            heardJohn102: false,
            heardJohn109: false,
            cityOpen: false,
            gemsRemaining: false,
            waterVerseAvailable: false
        })).toBe('I should find Biscuit.');
    });
});
