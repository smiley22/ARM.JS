///<reference path="jasmine.d.ts"/>
///<reference path="../Simulator/Util/BinaryReader.ts"/>

/**
 * Contains unit-tests for the BinaryReader class.
 */
describe('BinaryReader Tests', () => {
    /**
     * Ensures reading bytes from the underlying buffer yields the expected values.
     */
    it('Read Bytes', () => {
        var r = new ARM.Simulator.BinaryReader([0x80, 0x40, 0x20, 0x10]);
        expect(r.ReadInt8()).toBe(0xFFFFFF80.toInt32());
        r.Seek(0);
        expect(r.ReadUint8()).toBe(0x80);
        r.Seek(0);
        expect(r.ReadBytes(4)).toEqual([0x80, 0x40, 0x20, 0x10]);
    });

    /**
     * Ensures reading 16-bit shorts from the underlying buffer yields the expected values.
     */
    it('Read Shorts', () => {
        var r = new ARM.Simulator.BinaryReader([0x00, 0xFF]);
        expect(r.ReadInt16()).toBe(-256); // wacky JS number type.
        r.Seek(0);
        expect(r.ReadInt16(true)).toBe(0xFF);
        r.Seek(0);
        expect(r.ReadUint16()).toBe(0xFF00);
        r.Seek(0);
        expect(r.ReadUint16(true)).toBe(0xFF);
    });

    /**
     * Ensures reading 32-bit integers from the underlying buffer yields the expected values.
     */
    it('Read Ints', () => {
        var r = new ARM.Simulator.BinaryReader([0x23, 0x45, 0x67, 0x89]);
        expect(r.ReadInt32()).toBe(0x89674523.toInt32()); // wacky JS number type.
        r.Seek(0);
        expect(r.ReadInt32(true)).toBe(0x23456789);
        r.Seek(0);
        expect(r.ReadUint32()).toBe(0x89674523);
        r.Seek(0);
        expect(r.ReadUint32(true)).toBe(0x23456789);
    });

    /**
     * Ensures seeking back and forth within the underlying data buffer works as expected.
     */
    it('Can Seek', () => {
        var r = new ARM.Simulator.BinaryReader([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(r.Position).toBe(0);
        r.Seek(4);
        expect(r.Position).toBe(4);
        r.Seek(0);
        expect(r.Position).toBe(0);
        expect(() => r.Seek(100)).toThrowError('Eof');
    });
});