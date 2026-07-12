import { describe, expect, it } from 'vitest';

import { Percentage } from '../src/index.js';

describe('Percentage', () => {
    it('should create a percentage', () => {
        const percentage = new Percentage(25);

        expect(percentage.value).toBe(25);
    });

    it('should convert to decimal', () => {
        const percentage = new Percentage(25);

        expect(percentage.toDecimal()).toBe(0.25);
    });

    it('should add percentages', () => {
        const first = new Percentage(20);
        const second = new Percentage(30);

        const result = first.add(second);

        expect(result.value).toBe(50);
    });

    it('should subtract percentages', () => {
        const first = new Percentage(70);
        const second = new Percentage(20);

        const result = first.subtract(second);

        expect(result.value).toBe(50);
    });

    it('should multiply percentages', () => {
        const percentage = new Percentage(25);

        const result = percentage.multiply(2);

        expect(result.value).toBe(50);
    });

    it('should identify zero', () => {
        expect(Percentage.zero().isZero()).toBe(true);
    });

    it('should identify hundred', () => {
        expect(Percentage.hundred().isHundred()).toBe(true);
    });

    it('should reject values below zero', () => {
        expect(() => new Percentage(-1)).toThrow();
    });

    it('should reject values above hundred', () => {
        expect(() => new Percentage(101)).toThrow();
    });
});