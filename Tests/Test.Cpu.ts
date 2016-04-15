///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Cpu.ts"/>

/**
 * Contains unit-tests for the ARM7-like CPU.
 */
describe('CPU Tests', () => {
    var cpu: ARM.Simulator.Cpu;
    var read: (address: number, type: ARM.Simulator.DataType) => number = null;
    var write: (address: number, type: ARM.Simulator.DataType, value: number) => void = null;
    var clockRate = 6.9824; // Mhz
    // So we can access private properties and methods for testing opcode decoding and cpu
    // instructions without having to make all of this stuff 'public'. In this case it just
    // seems to make sense to also test the internals of the class.
    var _cpu: any;

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
        cpu = new ARM.Simulator.Cpu(clockRate, (a, t) => {
            if (read != null)
                return read(a, t);
            throw new Error('Could not read data at ' + a);
        }, (a, t, v) => {
            if (write != null)
                write(a, t, v);
            });
        _cpu = cpu;
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
    });

    /**
     * Ensures cpu registers contain default values after reset.
     */
    it('Reset Values', () => {
        // CPU Manual:
        //
        // Registers R0 - R14 (including banked registers) and SPSR (in all modes) are undefined
        // after reset. The Program Counter (PC/R15) will be set to 0x00000000. The Current
        // Program Status Register (CPSR) will indicate that the ARM core has started in ARM 
        // state, Supervisor mode with both FIQ and IRQ mask bits set.The condition code flags
        // will be undefined.
        expect(_cpu.pc).toBe(0);
        expect(_cpu.state).toBe(ARM.Simulator.CpuState.ARM);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
    });

    /**
     * Ensures the CPU properly decodes opcodes.
     */
    it('Opcode Decoding', () => {
        // ARM instructions generated with arm-none-eabi-as.
        var pairs = [
            [0xe0904002, _cpu.data],    // adds r4, r0, r2
            [0xe0a15003, _cpu.data],    // adc  r5, r1, r3
            [0xe280001a, _cpu.data],    // add  r0, r0, #26
            [0xe1510000, _cpu.data],    // cmp  r1, r0
            [0xeb000001, _cpu.b_bl], 	// bl	14
            [0xe12fff1e, _cpu.bx],      // bx   lr
            [0xe3c99003, _cpu.data] 	// bic	r9, r9, #3

        ];
        for (var p of pairs)
            expect(_cpu.Decode(p[0])).toBe(p[1]);
    });
});