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
            [0xeb000001, _cpu.b_bl],    // bl   14
            [0xe12fff1e, _cpu.bx],      // bx   lr
            [0xe3c99003, _cpu.data],    // bic  r9, r9, #3
            [0xee070f9a, _cpu.mrc_mcr], // mcr  15, 0, r0, cr7, cr10, {4}
            [0xe59f2038, _cpu.ldr_str], // ldr  r2, [pc, #56]
            [0xe129f000, _cpu.msr],     // msr  CPSR_fc, r0
            [0xee080f17, _cpu.mrc_mcr], // mcr  15, 0, r0, cr8, cr7, {0}
            [0xe59f2038, _cpu.ldr_str], // ldr  r2, [pc, #56]
            [0xe3c33001, _cpu.data],    // bic  r3, r3, #1
            [0xee013f10, _cpu.mrc_mcr], // mcr  15, 0, r3, cr1, cr0, {0}
            [0xe1a0f002, _cpu.data],    // mov  pc, r2
            [0xe59fc02c, _cpu.ldr_str], // ldr  ip, [pc, #44]
            [0xe3a000f3, _cpu.data],    // mov  r0, #243
            [0xe58c001f, _cpu.ldr_str], // str  r0, [ip, #31]
            [0xebfffffe, _cpu.b_bl],    // bl   0 <main>
            [0xeafffffe, _cpu.b_bl],    // b    58 <.text + 0x58>
            [0xe5901000, _cpu.ldr_str], // ldr  r1, [r0]
            [0xe3510000, _cpu.data],    // cmp  r1, #0
            [0x1a000000, _cpu.b_bl],    // bne  6c <.text + 0x6c>
            [0xe5801000, _cpu.ldr_str], // str  r1, [r0]
            [0xe5901008, _cpu.ldr_str], // ldr  r1, [r0, #8]
            [0xe590200c, _cpu.ldr_str], // ldr  r2, [r0, #12]
            [0xe4d13001, _cpu.ldr_str], // ldrb r3, [r1], #1
            [0x00000058, _cpu.data],    // andeq r0, r0, r8, asr r0
            [0x00001341, _cpu.data],    // andeq r1, r0, r1, asr #6
            [0x61750100, _cpu.data],    // cmnvs r5, r0, lsl #2
            [0x01100962, _cpu.data],    // tsteq r0, r2, ror #18
            [0x00000009, _cpu.data],    // andeq r0, r0, r9
            [0x01180306, _cpu.data]     // tsteq r8, r6, lsl #6
        ];
        for (var p of pairs)
            expect(_cpu.Decode(p[0])).toBe(p[1]);
    });
});