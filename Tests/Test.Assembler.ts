///<reference path="jasmine.d.ts"/>
///<reference path="../Assembler/Assembler.ts"/>

/**
 * Contains unit-tests for the ARMv4T Assembler.
 */
describe('Assembler Tests', () => {
    const Assembler = ARM.Assembler.Assembler;

    var memoryLayout: ARM.Assembler.HashTable<number> = {
        'TEXT': 0x40000,
        'DATA': 0x80000
    };

    /**
     * Assembly listing containing some invalid assembler directive.
     */
    var listing_1 = [
        '.arm',
        '.section .data',
        'hello_sio:',
        '.asciz "Hello World from serial I/O!"',
        '.section .text',
        '@ UART0 Registers',
        '.equ    U0RBR,            0xE0000000 @ Receiver Buffer',
        '.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer',
        '.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte',
        '',
        '@ Some unrecognized directive',
        '.foobar 12 34'
    ].join('\n');

    /**
     * Some sample assembly program.
     */
    var listing_2 = [
        '.arm',
        '.section .data',
        'hello_sio:',
        '.asciz "Hello World from serial I/O!"',
        '.section .text',
        '@ UART0 Registers',
        '.equ    U0RBR,            0xE0000000 @ Receiver Buffer',
        '.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer',
        '.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte',
        '.equ    U0DLH,            0xE0000004 @ Divisor Latch High Byte',
        '.equ    U0IER,            0xE0000004 @ Interrupt Enable Register',
        '.equ    U0IIR,            0xE0000008 @ Interrupt Identification Register',
        '.equ    U0FCR,            0xE0000008 @ FIFO Control Register',
        '.equ    U0LCR,            0xE000000C @ Line Control Register',
        '.equ    U0LSR,            0xE0000014 @ Line Status Register',
        '.equ    U0SCR,            0xE000001C @ Scratch Register',
        '',
        '.equ    LCR8N1,           0x03       @ 8 Bits, 1 Stop bit, no parity',
        '.equ    PCON,             0xE01FC000 @ Power Control Register',
        '',
        '.equ    RAM_SIZE,         0x00008000 @ 32kb',
        '.equ    RAM_BASE,         0x00400000',
        '.equ    TOPSTACK,         RAM_BASE + RAM_SIZE',
        '',
        '@R13 acts as stack pointer by convention',
        'ldr  r0,  =TOPSTACK',
        'mov  r13, r0',
        '',
        '@ prints a string to the terminal',
        'main:',
        '  bl sio_init',
        '  ldr r0, =hello_sio',
        '  bl sio_puts',
        '  @ busy wait until UART is done before exiting',
        '  ldr r0, =U0LSR',
        'still_busy:',
        '    ldrb r1, [r0], #0',
        '    ands r1, #64',
        '    beq still_busy',
        '  bl _exit',
        '',
        '@ initializes UART0',
        'sio_init:',
        '   stmfd sp!, { r0-r1, lr }',
        '   ldr r0, =U0LCR',
        '   @enable DLAB to configure baudrate',
        '   mov r1, #128',
        '   strb r1, [r0], #0',
        '   @set baudrate to 115200 (DLH = 0x00, DLL = 0x01)',
        '   ldr r0, =U0DLH',
        '   mov r1, #0',
        '   strb r1, [r0], #0',
        '   ldr r0, =U0DLL',
        '   mov r1, #1',
        '   strb r1, [r0], #0',
        '   @clear DLAB and set mode to 8- N - 1',
        '   ldr r0, =U0LCR',
        '   ldrb r1, =LCR8N1',
        '   strb r1, [r0], #0',
        '   @disable all interrupts',
        '   ldr r0, =U0IER',
        '   mov r1, #0',
        '   strb r1, [r0], #0',
        '   @enable and reset 64- byte FIFOs',
        '   ldr r0, =U0FCR',
        '   mov r1, #39',
        '   strb r1, [r0], #0',
        '   @done!',
        '   ldmfd sp!, { r0-r1, lr }',
        '   bx lr',
        '',
        '@r0 -> character to transmit',
        'sio_putc:',
        '   stmfd sp!, { r1-r2, lr }',
        '   ldr r1, =U0LSR',
        '   fifo_full:',
        '       ldrb r2, [r1], #0',
        '       @cleared bit 5 means TXFIFO is full',
        '       ands r2, #32',
        '   beq fifo_full',
        '   ldr r1, =U0THR',
        '   strb r0, [r1], #0',
        '   ldmfd sp!, { r1-r2, lr }',
        '   bx lr',
        '',
        '@r0 -> null - terminated string to transmit',
        'sio_puts:',
        '   stmfd sp!, { r0-r1, lr }',
        '   mov r1, r0',
        '   char_loop:',
        '       ldrb r0, [r1], #1',
        '       cmp r0, #0',
        '       beq char_loop_end',
        '       bl sio_putc',
        '       b char_loop',
        '   char_loop_end:',
        '       ldmfd sp!, { r0-r1, lr }',
        '       bx lr',
        '',
        '@halts execution',
        '_exit:',
        '   @power is turned off by setting bit 1',
        '   ldr r0, =PCON',
        '   mov r1, #1',
        '   strb r1, [r0]',
        '.end'
    ].join('\n');

    /**
     * Ensures trying to assemble source code containing invalid directives raises an exception.
     */
    it('Invalid Assembler Directive', () => {
        expect(() => 
            Assembler.Assemble(listing_1, memoryLayout)
        ).toThrow();
    });

    /**
     * Ensures assembling a sample program yields the expected results.
     */
    it('Assemble Some Code', () => {
        var a_out = Assembler.Assemble(listing_2, memoryLayout);
        expect(a_out['TEXT']).toBeDefined();
        expect(a_out['DATA']).toBeDefined();
        expect(a_out['TEXT'].address).toBe(memoryLayout['TEXT']);
        expect(a_out['DATA'].address).toBe(memoryLayout['DATA']);
    });

    /**
     * Ensures assembling instructions yields the expected 32-bit ARM instruction words.
     */
    it('Assemble Instructions', () => {
        // FIXME: This just tests a couple of random instructions. It'd be better to have a proper
        //        test-suite that systematically tests each individual instruction...
        var instructions = {
            // Assembled with arm-none-eabi-as.
            'mov r0, r0'                : 0xE1A00000,
            'adds r4, r0, r2'           : 0xE0904002,
            'adc r5, r1, r3'            : 0xE0A15003,
            'add r7, r8, r10, LSL #4'   : 0xE088720A,
            'add r1, pc, #123'          : 0xE28F107B,
            'mrs r0, cpsr'              : 0xE10F0000,
            'bic r0, r0, #0x1f'         : 0xE3C0001F,
            'orr r0, r0, #0x13'         : 0xE3800013,
            'stmfd r13!, {r0-r12, r14}' : 0xE92D5FFF,
            'ldmfd r13!, {r0-r12, pc}'  : 0xE8BD9FFF,
            'swi 0x10'                  : 0xEF000010,
            'ldmia r2, {r0, r1}'        : 0xE8920003,
            // This differs from ours because we use a different addressing mode.
            // TODO: Make sure instruction is equivalent.
//            'strh r1, [r3]'             : 0xE1C310B0,
            'movge r2, r0'              : 0xA1A02000,
            'movlt r2, r1'              : 0xB1A02001,
            'ldr r0, [r1, r2, lsl #2]'  : 0xE7910102,
       //     'sub r0, r1, r0, asr #31': 0xE0410FC0,
            'sublts r3, r0, r1'         : 0xB0503001,
            'strcs r3, [r0], #4'        : 0x24803004
        };
        for (let key in instructions) {
            let sections = Assembler.Assemble(key, memoryLayout),
                data = sections['TEXT'].data,
                view = new Uint32Array(data.buffer);
            expect(view[0]).toBe(instructions[key]);
        }
    });
});