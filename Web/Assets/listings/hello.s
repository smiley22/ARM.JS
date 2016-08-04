@
@ Hello World from ARMv4T and HITACHI HD44780
@
@ This listing demonstrates the configuration and usage of the programmable
@ interrupt controller (PIC). The PIC's outgoing interrupt signals are inverted
@ and fed into the CPU's nFIQ and nIRQ inputs, respectively.
@
@ This example program bootstraps the system, initializes the PIC and then
@ configures one of the hardware timers to periodically raise interrupts with
@ the PIC. The interrupt service routine then increments a counter value which
@ is output to the LCD display.
@
.arm
.section .data
hello:
    .asciz "Hello World from ARMv4T! This is a HITACHI HD44780 compliant LCD controller."
.section .text
@ LCDC and GPIO Registers
.equ    LCDIOCTL,         0xE0008000 @ LCD I/O Control
.equ    LCDDATA,          0xE0008004 @ LCD Data Bus
.equ    IO0DIR,           0xE001C004 @ GPIO Direction Control Register
.equ    IO0SET,           0xE001C008 @ Drive output pins HIGH
.equ    IO0CLR,           0xE001C00C @ Drive output pins LOW
@ Power Control Register
.equ    PCON,             0xE01FC000
.equ    RAM_SIZE,         0x00008000 @ 32kb
.equ    RAM_BASE,         0x00040000
.equ    TOPSTACK,         RAM_BASE + RAM_SIZE

@ LCD commands, refer to HITACHI HD44780 manual for details.
@ Clear entire display and set DDRAM address 0 in address counter.
.equ   LCD_CMD_DISP_CLEAR,    0x01
@ Set to 8-bit operation and select 2-line display and 5x8 dot
@ character font.
.equ   LCD_CMD_FUNCTION_SET,  0x38
@ Turn on display and cursor, enable cursor blinking. Entire display
@ is in space mode because of initialization.
.equ   LCD_CMD_DISP_CONTROL,  0x0F
@ Sets mode to increment the address by one and to shift the cursor
@ to the right at the time of write to the DD/CGRAM. Display is not
@ shifted.
.equ   LCD_CMD_ENTRY_MODE,    0x06

@ R13 acts as stack pointer by convention.
ldr  r0,  =TOPSTACK
mov  r13, r0

@ Initialize the LCD controller and LED GPIO ports.
bl lcd_init
bl led_init
@ The main program loop that is repeated over and over again.
loop:
  @ Output string to LCD.
  ldr r1, =hello
  mov r5, #0
  write_char:
    ldrb r0, [r1], #1
    add r5, r5, #1
    cmp r0, #0
    beq done
    @ Start shifting LCD display after first 16 characters.
    cmp r5, #16
    bleq enable_display_shift
    @ Enable display shift again when end of second display line
    @ is reached.
    cmp r5, #54
    bleq enable_display_shift
    @ Switch to second display line after first 40 characters have
    @ been output.
    cmp r5, #39
    bleq switch_to_second_line
    bl lcd_write_char
    bl delay
    b write_char
    done:
      @ Flash LCD and LEDs.
      bl flash_display
      bl flash_leds
      @ Then start over again.
      bl lcd_clear
      bl disable_display_shift
      b loop

@
@ Sets the LCD's display mode to right-shift the display at the time of
@ write.
@
enable_display_shift:
  stmfd sp!, {r0,lr}
  mov r0, #7
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@
@ Disables LCD display shifting.
@
disable_display_shift:
  stmfd sp!, {r0,lr}
  mov r0, #6
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@
@ Moves the cursor in display RAM to the starting address of the second
@ display line at LCD memory address 0x40.
@
switch_to_second_line:
  stmfd sp!, {r0,lr}
  bl delay
  bl delay
  mov r0, #0x02
  bl lcd_command
  mov r0, #0xC0
  bl lcd_command
  mov r0, #0x06
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@
@ Initializes the LCD controller.
@
lcd_init:
  stmfd sp!, {r0-r2,lr}
  ldr r0, =LCD_CMD_FUNCTION_SET
  bl lcd_command
  @ Turn on display and cursor.
  ldr r0, =LCD_CMD_DISP_CONTROL 
  bl lcd_command
  ldr r0, =LCD_CMD_ENTRY_MODE
  bl lcd_command
  ldmfd sp!, {r0-r2,lr}
  bx lr

@
@ Issues a command to the LCD controller.
@
lcd_command:
  stmfd sp!, {r1-r3,lr}
  ldr r1, =LCDIOCTL
  mov r2, #4 @ E high
  str r2, [r1], #0
  ldr r3, =LCDDATA
  str r0, [r3], #0
  mov r2, #0 @ E low
  str r2, [r1], #0
  @ delay for a couple of cycles
  ldmfd sp!, {r1-r3,lr}
  bx lr

@
@ Clears the LCD display and resets the cursor to the top-left position.
@
lcd_clear:
  stmfd sp!, {r0,lr}
  ldr r0, =LCD_CMD_DISP_CLEAR
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@
@ Writes a single character to the current position of the LCD cursor.
@
@ r0 -> character to write.
@
lcd_write_char:
  stmfd sp!, {r1-r3,lr}
  ldr r1, =LCDIOCTL
  mov r2, #5 @ RS high, E high
  str r2, [r1], #0
  ldr r3, =LCDDATA
  strb r0, [r3], #0
  mov r2, #1 @ RS high, E low
  str r2, [r1], #0
  ldmfd sp!, {r1-r3,lr}
  bx lr

@
@ Writes a null-terminated string to the LCD.
@
@ r0 -> null-terminated string to write.
@
lcd_write_string:
  stmfd sp!, {r0-r1,lr}
  mov r1, r0
  char_loop:
    ldrb r0, [r1], #1
    cmp r0, #0
    beq char_loop_end
    bl lcd_write_char
    b char_loop
  char_loop_end:
    ldmfd sp!, {r0-r1,lr}
    bx lr

@
@ Delays execution for a couple of clock-cycles.
@
delay:
  stmfd sp!, {r0,lr}
  ldr r0, =#100
  delay_loop:
    subs r0, r0, #1
    beq delay_end
    b delay_loop
  delay_end:
    ldmfd sp!, {r0,lr}
    bx lr

@
@ Turns the LCD display on and off a couple of times.
@
flash_display:
  stmfd sp!, {r0-r1,lr}
  mov r1, #10
  ldr r0, =LCD_CMD_DISP_CONTROL
  flash_display_loop:
    bl lcd_command
    eor r0, r0, #4
    bl delay
    bl delay
    subs r1, r1, #1
    bne flash_display_loop
  ldr r0, =LCD_CMD_DISP_CONTROL
  bl lcd_command
  ldmfd sp!, {r0-r1,lr}
  bx lr

@
@ Configures GPIO Port 0 pins P0.0 - P0.9 for output.
@
led_init:
  stmfd sp!, {r0-r1,lr}
  ldr r0, =IO0DIR
  ldr r1, =0x3FF @ P0.0 - P0.9
  str r1, [r0], #0
  ldmfd sp!, {r0-r1,lr}
  bx lr

@
@ Flashes the LEDs and runs a little LED animation.
@
flash_leds:
  stmfd sp!, {r0-r5,lr}
  mov r1, #1
  ldr r0, =IO0SET
  ldr r4, =IO0CLR
  flash_leds_loop:
    strb r1, [r0], #0
    movs r1, r1, LSL #1
    add r1, r1, #1
    bl delay
    bl delay
    cmp r1, #0xff
    ble flash_leds_loop
  mov r1, #0xff
  mov r2, r0
  mov r3, #8
  toggle_all_loop:
   strb r1, [r2], #0
   bl delay
   bl delay
   mov r5, r2
   mov r2, r4
   mov r4, r5
   subs r3, r3, #1
   bne toggle_all_loop
  mov r1, #0
  strb r1, [r0], #0
  ldmfd sp!, {r0-r5,lr}
  bx lr

@ halts execution
_exit:
  @ power is turned off by setting bit 1
  ldr r0, =PCON
  mov r1, #1
  strb r1, [r0]
.end