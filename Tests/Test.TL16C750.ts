///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/TL16C750.ts"/>

/**
 * Contains unit-tests for the TL16C750 device.
 */
describe('TL16C750 Tests', () => {
    var uart: ARM.Simulator.Devices.TL16C750;
    var service: ARM.Simulator.Tests.MockService;
    var interrupt: (active: boolean) => void = null;

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
        uart = new ARM.Simulator.Devices.TL16C750(0, active => {
            if (interrupt != null)
                interrupt(active);
        });
        service = new ARM.Simulator.Tests.MockService();
        expect(uart.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        interrupt = null;
        uart.OnUnregister();
    });

    /**
     * Ensures UART registers contain expected reset values after a master reset.
     * See TL16C750 Manual 'Principles Of Operation'.
     */
    it('Function Reset', () => {
        var registers = [
            // Interrupt Enable Register (IER).
            // All bits cleared (0–5 forced and 6–7 permanent).
            [0x04, 0x00],
            // Interrupt Identification Register (IIR).
            // Bit 0 is set, bits 1–4 are cleared, and bits 5–7 are cleared.
            [0x08, 0x01],
            // Line Control Register (LCR).
            // All bits cleared.
            [0x0C, 0x00],
            // Modem Control Register (MCR).
            // All bits cleared.
            [0x10, 0x00],
            // Line Status Register (LSR).
            // Bits 5 and 6 are set, all other bits are cleared.
            [0x14, 0x60]
        ];
        for (var entry of registers) {
            var value = uart.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });

    /**
     * Ensures UART initialization and character transmission from UART -> TTY work as expected.
     */
    it('Serial IO #1', () => {
        // Init sequence taken from random source (http://wiki.osdev.org/Serial_Ports).
        var values = [
            [0x04, 0x00],   // Disable all interrupts
            [0x0C, 0x80],   // Enable DLAB (set baud rate divisor)
            [0x00, 0x03],   // Set divisor to 3 (lo byte) 38400 baud
            [0x04, 0x00],   //                  (hi byte)
            [0x0C, 0x03],   // 8 bits, no parity, one stop bit
            [0x08, 0xC7],   // Enable FIFO, clear them, with 14-byte threshold
            [0x10, 0x0B]    // IRQs enabled, RTS/DSR set
        ];
        for (var pair of values)
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
        var chars = ['H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd'];
        for (var c of chars) {
            uart.Write(0, ARM.Simulator.DataType.Word, c.charCodeAt(0));
            jasmine.clock().tick(20);
        }
        // UART should have raised an event with the VM for each transmitted character.
        expect(service.RaisedEvents.length).toBe(chars.length);
        for (var i = 0; i < service.RaisedEvents.length; i++) {
            expect(service.RaisedEvents[i][0]).toBe('TL16C750.Data');
            expect(service.RaisedEvents[i][1]).toBe(chars[i].charCodeAt(0));
        }
    });

    /**
     * Ensures UART initialization and character transmission from TTY -> UART work as expected.
     */
    it('Serial IO #2', () => {
        var actualString = '';
        interrupt = () => {
            var iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            // Interrupt is pending.
            while ((iir & 0x01) === 0) {
                var character = uart.Read(0, ARM.Simulator.DataType.Word);
                actualString = actualString.concat(String.fromCharCode(character));
                iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            }
        };
        // Using a slightly different init sequence than in #1.
        var values = [
            [0x0C, 0x80],   // Enable DLAB (set baud rate divisor)
            [0x00, 0x01],   // Set divisor to 1 (lo byte) 115200 baud
            [0x04, 0x00],   //                  (hi byte)
            [0x0C, 0x03],   // Clear DLAB, set mode to 8-N-1.
            [0x04, 0x00],   // Disable all interrupts
            [0x04, 0x01]    // Enable the 'received data available' interrupt
        ];
        for (var pair of values) {
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
            jasmine.clock().tick(10);
        }
        // Transmit some data from terminal to UART.
        var message = 'Hello from tty! This is just a test.';
        for (var char of message) {
            uart.SerialInput(char.charCodeAt(0));
            jasmine.clock().tick(20);
        }
        expect(actualString).toMatch(message);
    });

    /**
     * Ensures UART initialization and character transmission from TTY -> UART work as expected
     * using UART interrupts with a configured FIFO trigger-level.
     */
    it('Serial IO #3', () => {
        var fifoTriggerLevel = 16;
        var actualData = [];
        // Install UART interrupt handler.
        interrupt = active => {
            if (active === false)
                return;
            var iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            // Interrupt is pending.
            while ((iir & 0x01) === 0) {
                if ((iir & 0x0C) === 0x0C) {
                    // FIFO character timeout indication interrupt.
                    let character = uart.Read(0, ARM.Simulator.DataType.Word);
                    actualData.push(String.fromCharCode(character));
                }
                // Trigger-Level reached interrupt.
                else if ((iir & 0x04) === 0x04) {
                    // We know that when the interrupt is triggered, there's at least 16 characters
                    // in the FIFO so we can read them in one batch.
                    for (let i = 0; i < fifoTriggerLevel; i++) {
                        let character = uart.Read(0, ARM.Simulator.DataType.Word);
                        actualData.push(String.fromCharCode(character));
                    }
                }
                iir = uart.Read(0x08, ARM.Simulator.DataType.Word);
            }
        };
        // Using a slightly different init sequence than in #1.
        var values = [
            [0x0C, 0x80],   // Enable DLAB (set baud rate divisor)
            [0x00, 0x01],   // Set divisor to 1 (lo byte) 115200 baud
            [0x04, 0x00],   //                  (hi byte)
            [0x0C, 0x83],   // Set mode to 8-N-1. Don't clear DLAB since it needs to be set for
                            // enabling 64-byte FIFOs
            [0x04, 0x00],   // Disable all interrupts
            [0x08, 0x67],   // Enable and reset 64-byte FIFOs. Set FIFO trigger-level to 16
            [0x0C, 0x03],   // Clear DLAB
            [0x04, 0x01]    // Enable the 'received data available' interrupt
        ];
        for (var pair of values) {
            uart.Write(pair[0], ARM.Simulator.DataType.Word, pair[1]);
            jasmine.clock().tick(10);
        }
        // Transmit some data from terminal to UART. The first 16 characters will be read when
        // a FIFO trigger-level interrupt is raised. The remaining characters will be read when
        // FIFO character timeout indications are raised.
        var message = 'Hello from test tty!';
        // Message must be at least 16 characters long so FIFO interrupt is triggered.
        expect(message.length).toBeGreaterThan(15);
        for (var char of message) {
            uart.SerialInput(char.charCodeAt(0));
            jasmine.clock().tick(20);
        }
        expect(actualData.length).toBe(message.length);
        for (let i = 0; i < actualData.length; i++)
            expect(actualData[i]).toBe(message[i]);
    });
});