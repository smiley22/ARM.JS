///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Memory.ts"/>

/**
 * Contains unit-tests for the Memory interface.
 */
describe('Memory Tests', () => {
    var memory: ARM.Simulator.Memory;
    var service: ARM.Simulator.Tests.MockService;

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
    });

    /**
     * Tear down the test fixture. Runs after all test methods have been run.
     */
    afterAll(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        memory = new ARM.Simulator.Memory();
        service = new ARM.Simulator.Tests.MockService();
    });

    /**
     * Ensures a 'BadAddress' error is thrown when an attempt is made to read or write from or
     * to an unmapped memory region.
     */
    it('Illegal Access', () => {
        var pairs = [
            [0x12345678, ARM.Simulator.DataType.Byte],
            [0xFFFFFFFF, ARM.Simulator.DataType.Halfword],
            [0x80808080, ARM.Simulator.DataType.Word]
        ];
        for (var p of pairs) {
            expect(() => memory.Read(p[0], p[1])).toThrowError('BadAddress');
            expect(() => memory.Write(p[0], p[1], 0)).toThrowError('BadAddress');
        }
    });

    /**
     * Ensures regions can be mapped to and unmapped from the memory address space.
     */
    it('Map and unmap regions', () => {
        var region = new ARM.Simulator.Region(
            0x80000000, // Base address of region in 4GB address space
            0x10000);   // Size in bytes (64kb)
        expect(memory.Map(region)).toBe(true);
        // Trying to map the same region twice shouldn't work.
        expect(memory.Map(region)).toBe(false);
        // Write and read some data to memory.
        var tuples = [
            [0x80000000, 0x12345678, ARM.Simulator.DataType.Word],
            [0x8000ABCD, 0xACED, ARM.Simulator.DataType.Halfword],
            [0x8000FFFF, 0x98, ARM.Simulator.DataType.Byte]
        ];
        for (let t of tuples) {
            memory.Write(t[0], t[2], t[1]);
            var readValue = memory.Read(t[0], t[2]);
            expect(readValue).toBe(t[1]);
        }
        expect(memory.Unmap(region)).toBe(true);
        // Trying to ummap the same region twice shouldn't work.
        expect(memory.Unmap(region)).toBe(false);
        // Trying to write or read after unmapping should result in error.
        for (let t of tuples) {
            expect(() => memory.Write(t[0], t[2], t[1])).toThrowError('BadAddress');
            expect(() => memory.Read(t[0], t[2])).toThrowError('BadAddress');
        }
    });

    /**
     * Ensures it's not possible to map overlapping regions into the address space.
     */
    it('Overlapping regions', () => {
        var a = new ARM.Simulator.Region(0x00000000, 0x00001000);
        var b = new ARM.Simulator.Region(0x00000100, 0x00000100);
        expect(memory.Map(a)).toBe(true);
        expect(memory.Map(b)).toBe(false);
        // After a has been unmapped, mapping b should work.
        expect(memory.Unmap(a)).toBe(true);
        expect(memory.Map(b)).toBe(true);
        expect(memory.Map(a)).toBe(false);
        expect(memory.Unmap(b)).toBe(true);
    });

    /**
     * Ensures reading and writing the different data types supported by the memory
     * interface works as expected.
     */
    it('Data Types', () => {
        var region = new ARM.Simulator.Region(0x00000000, 0x00001000);
        expect(memory.Map(region)).toBe(true);
        var word = 0x12345678;
        memory.Write(0, ARM.Simulator.DataType.Word, word);
        // Reading a word from address 0 should yield the value we wrote.
        var read = memory.Read(0, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
        // Reading a half-word should yield the 16 LSB (Little Endian)
        read = memory.Read(0, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x5678);
        // Reading a half-word from offset 2 should yield the upmost 16-bits.
        read = memory.Read(2, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x1234);
        // Reading a byte should yield the 'little end' first (Little Endian).
        for (let i = 0; i < 4; i++) {
            read = memory.Read(i, ARM.Simulator.DataType.Byte);
            expect(read).toBe((word >>> (i * 8)) & 0xFF);
        }
        // Words can only be read from addresses aligned to four-byte boundaries,
        // the lower 2 address bits are ignored. So reading from address 0x02
        // should yield the original word written to address 0x00.
        read = memory.Read(2, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
        // Same goes for half-words and two-byte boundaries.
        read = memory.Read(1, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x5678);
        read = memory.Read(3, ARM.Simulator.DataType.Halfword);
        expect(read).toBe(0x1234);
        // Write a sequence of bytes and read as a 32-bit word.
        var bytes = [0x78, 0x56, 0x34, 0x12];
        var address = 0x0ABC;
        for (let i = 0; i < bytes.length; i++)
            memory.Write(address + i, ARM.Simulator.DataType.Byte, bytes[i]);
        // Reading as 32-bit word should yield 0x12345678.
        read = memory.Read(address, ARM.Simulator.DataType.Word);
        expect(read).toBe(word);
    });

    /**
     * Ensures custom read/write callbacks are invoked when provided for a memory region.
     */
    it('Memory-mapped registers', () => {
        var readCalled = false;
        var writeCalled = false;
        var region = new ARM.Simulator.Region(0x00400000,
            0x00010000,
            (a, t) => {
                expect(a).toBe(0x8000);
                expect(t).toBe(ARM.Simulator.DataType.Byte);
                readCalled = true;
                return 0x42;
            },
            (a, t, v) => {
                expect(a).toBe(0x1234);
                expect(t).toBe(ARM.Simulator.DataType.Word);
                expect(v).toBe(0x12345678);
                writeCalled = true;
            });
        expect(memory.Map(region)).toBe(true);
        // Writing to a memory address within the region should invoke the provided
        // write callback.
        memory.Write(0x00401234, ARM.Simulator.DataType.Word, 0x12345678);
        expect(writeCalled).toBe(true);
        // Reading from a memory address within the region should invoke the provided
        // read callback.
        var value = memory.Read(0x00408000, ARM.Simulator.DataType.Byte);
        expect(readCalled).toBe(true);
        expect(value).toBe(0x42);
    });
});