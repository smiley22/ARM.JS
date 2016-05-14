describe('BinaryReader Tests', function () {
    it('Read Bytes', function () {
        var r = new ARM.Simulator.BinaryReader([0x80, 0x40, 0x20, 0x10]);
        expect(r.ReadInt8()).toBe(0xFFFFFF80 .toInt32());
        r.Seek(0);
        expect(r.ReadUint8()).toBe(0x80);
        r.Seek(0);
        expect(r.ReadBytes(4)).toEqual([0x80, 0x40, 0x20, 0x10]);
    });
    it('Read Shorts', function () {
        var r = new ARM.Simulator.BinaryReader([0x00, 0xFF]);
        expect(r.ReadInt16()).toBe(-256);
        r.Seek(0);
        expect(r.ReadInt16(true)).toBe(0xFF);
        r.Seek(0);
        expect(r.ReadUint16()).toBe(0xFF00);
        r.Seek(0);
        expect(r.ReadUint16(true)).toBe(0xFF);
    });
    it('Read Ints', function () {
        var r = new ARM.Simulator.BinaryReader([0x23, 0x45, 0x67, 0x89]);
        expect(r.ReadInt32()).toBe(0x89674523 .toInt32());
        r.Seek(0);
        expect(r.ReadInt32(true)).toBe(0x23456789);
        r.Seek(0);
        expect(r.ReadUint32()).toBe(0x89674523);
        r.Seek(0);
        expect(r.ReadUint32(true)).toBe(0x23456789);
    });
    it('Can Seek', function () {
        var r = new ARM.Simulator.BinaryReader([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(r.Position).toBe(0);
        r.Seek(4);
        expect(r.Position).toBe(4);
        r.Seek(0);
        expect(r.Position).toBe(0);
        expect(function () { return r.Seek(100); }).toThrowError('Eof');
    });
});
//# sourceMappingURL=Test.BinaryReader.js.map