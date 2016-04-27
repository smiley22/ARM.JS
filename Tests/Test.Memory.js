describe('Memory Tests', function () {
    var memory;
    var service;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        memory = new ARM.Simulator.Memory();
        service = new ARM.Simulator.Tests.MockService();
    });
    it('Illegal Access', function () {
        var pairs = [
            [0x12345678, ARM.Simulator.DataType.Byte],
            [0xFFFFFFFF, ARM.Simulator.DataType.Halfword],
            [0x80808080, ARM.Simulator.DataType.Word]
        ];
        for (var _i = 0, pairs_1 = pairs; _i < pairs_1.length; _i++) {
            var p = pairs_1[_i];
            expect(function () { return memory.Read(p[0], p[1]); }).toThrowError('BadAddress');
            expect(function () { return memory.Write(p[0], p[1], 0); }).toThrowError('BadAddress');
        }
    });
    it('Map and unmap regions', function () {
        var region = new ARM.Simulator.Region(0x80000000, 0x10000);
        expect(memory.Map(region)).toBe(true);
        expect(memory.Map(region)).toBe(false);
        var tuples = [
            [0x80000000, 0x12345678, ARM.Simulator.DataType.Word],
            [0x8000ABCD, 0xACED, ARM.Simulator.DataType.Halfword],
            [0x8000FFFF, 0x98, ARM.Simulator.DataType.Byte]
        ];
        for (var _i = 0, tuples_1 = tuples; _i < tuples_1.length; _i++) {
            var t = tuples_1[_i];
            memory.Write(t[0], t[2], t[1]);
            var readValue = memory.Read(t[0], t[2]);
            expect(readValue).toBe(t[1]);
        }
        expect(memory.Unmap(region)).toBe(true);
        expect(memory.Unmap(region)).toBe(false);
        var _loop_1 = function(t) {
            expect(function () { return memory.Write(t[0], t[2], t[1]); }).toThrowError('BadAddress');
            expect(function () { return memory.Read(t[0], t[2]); }).toThrowError('BadAddress');
        };
        for (var _a = 0, tuples_2 = tuples; _a < tuples_2.length; _a++) {
            var t = tuples_2[_a];
            _loop_1(t);
        }
    });
    it('Overlapping regions', function () {
        var a = new ARM.Simulator.Region(0x00000000, 0x00001000);
        var b = new ARM.Simulator.Region(0x00000100, 0x00000100);
        expect(memory.Map(a)).toBe(true);
        expect(memory.Map(b)).toBe(false);
        expect(memory.Unmap(a)).toBe(true);
        expect(memory.Map(b)).toBe(true);
        expect(memory.Map(a)).toBe(false);
        expect(memory.Unmap(b)).toBe(true);
    });
    it('Data Types', function () {
        var region = new ARM.Simulator.Region(0x00000000, 0x00001000);
        expect(memory.Map(region)).toBe(true);
        var word = 0x12345678;
        memory.Write(0, ARM.Simulator.DataType.Word, word);
        var read = memory.Read(0, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
        read = memory.Read(0, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x5678);
        read = memory.Read(2, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x1234);
        for (var i = 0; i < 4; i++) {
            read = memory.Read(i, ARM.Simulator.DataType.Byte);
            expect(read).toBe((word >>> (i * 8)) & 0xFF);
        }
        read = memory.Read(2, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
        read = memory.Read(1, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x5678);
        read = memory.Read(3, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x1234);
        var bytes = [0x78, 0x56, 0x34, 0x12];
        var address = 0x0ABC;
        for (var i = 0; i < bytes.length; i++)
            memory.Write(address + i, ARM.Simulator.DataType.Byte, bytes[i]);
        read = memory.Read(address, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
    });
    it('Memory-mapped registers', function () {
        var readCalled = false;
        var writeCalled = false;
        var region = new ARM.Simulator.Region(0x00400000, 0x00010000, function (a, t) {
            expect(a).toBe(0x8000);
            expect(t).toBe(ARM.Simulator.DataType.Byte);
            readCalled = true;
            return 0x42;
        }, function (a, t, v) {
            expect(a).toBe(0x1234);
            expect(t).toBe(ARM.Simulator.DataType.Word);
            expect(v).toBe(0x12345678);
            writeCalled = true;
        });
        expect(memory.Map(region)).toBe(true);
        memory.Write(0x00401234, ARM.Simulator.DataType.Word, 0x12345678);
        expect(writeCalled).toBe(true);
        var value = memory.Read(0x00408000, ARM.Simulator.DataType.Byte);
        expect(readCalled).toBe(true);
        expect(value).toBe(0x42);
    });
});
//# sourceMappingURL=Test.Memory.js.map