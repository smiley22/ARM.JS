.arm
.section .data
hello:
    .asciz "Hello World from ARMv4T!"
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

@ LCD initialization commands
.equ   LCD_CMD_DISP_CLEAR,    0x01
.equ   LCD_CMD_FUNCTION_SET,  0x3C
.equ   LCD_CMD_DISP_CONTROL,  0x0F
.equ   LCD_CMD_ENTRY_MODE,    0x06

@ R13 acts as stack pointer by convention
ldr  r0,  =TOPSTACK
mov  r13, r0

@ initialize LCD and LEDs
bl lcd_init
bl led_init

bl flash_leds
b _exit

loop:
  @ output string to LCD
  ldr r1, =hello
  write_char:
    ldrb r0, [r1], #1
    cmp r0, #0
    beq done
    bl lcd_write_char
    bl delay
    b write_char
done:
  @ flash LCD and LEDs
  bl flash_display
  bl flash_leds
  @ then start over again
  bl lcd_clear
  b loop

@ exit simulator
bl _exit

@ sets up the LCD display
lcd_init:
  stmfd sp!, {r0-r2,lr}
  @ Set to 8-bit operation and selects 2-line display and 5x8
  @ dot character font.
  mov r0, #0x38
  bl lcd_command
  @ Turn on display and cursor.
  mov r0, #0x0E
  bl lcd_command
  @ Sets mode to increment the address by one and to shift the
  @ cursor to the right at the time of write to the DD/CGRAM. Display
  @ is not shifted.
  mov r0, #0x06
  bl lcd_command
  ldmfd sp!, {r0-r2,lr}
  bx lr

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

@ clears display and resets cursor
lcd_clear:
  stmfd sp!, {r0,lr}
  ldr r0, =LCD_CMD_DISP_CLEAR
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@ writes a single character to the current
@ position of the LCD cursor
lcd_write_char:
  stmfd sp!, {r1,lr}
  ldr r1, =LCDDATA
  strb r0, [r1], #0
  ldmfd sp!, {r1,lr}
  bx lr

@ writes a null-terminated string to the LCD
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

@ delays execution
delay:
  stmfd sp!, {r0,lr}
  ldr r0, =#200
delay_loop:
  subs r0, r0, #1
  beq delay_end
  b delay_loop
delay_end:
  ldmfd sp!, {r0,lr}
  bx lr

@ turns the display on and off a couple of times
flash_display:
  stmfd sp!, {r0-r1,lr}
  mov r1, #10
  ldr r0, =LCD_CMD_DISP_CONTROL
flash_display_loop:
    bl lcd_command
    eor r0, r0, #4
    bl delay
    subs r1, r1, #1
    bne flash_display_loop
  ldr r0, =LCD_CMD_DISP_CONTROL
  bl lcd_command
  ldmfd sp!, {r0-r1,lr}
  bx lr

@ configures GPIO Port 0 pins P0.0 - P0.9 as output
led_init:
  stmfd sp!, {r0-r1,lr}
  ldr r0, =IO0DIR
  ldr r1, =0x3FF @ P0.0 - P0.9
  str r1, [r0], #0
  ldmfd sp!, {r0-r1,lr}
  bx lr

@ flashes the LEDs and runs a little LED animation
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
    cmp r1, #0xff
    ble flash_leds_loop
  mov r1, #0xff
  mov r2, r0
  mov r3, #8
toggle_all_loop:
   strb r1, [r2], #0
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