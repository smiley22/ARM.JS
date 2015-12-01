#ifndef _DEVBOARD_H_
#define _DEVBOARD_H_

#define MEM_BASE 0xE0000000

/* UART0 */
#define U0RBR           (*((volatile unsigned long *) (MEM_BASE + 0x0000)))
#define U0THR           (*((volatile unsigned long *) (MEM_BASE + 0x0000)))
#define U0DLL           (*((volatile unsigned long *) (MEM_BASE + 0x0000)))
#define U0DLH           (*((volatile unsigned long *) (MEM_BASE + 0x0004)))
#define U0IER           (*((volatile unsigned long *) (MEM_BASE + 0x0004)))
#define U0IIR           (*((volatile unsigned long *) (MEM_BASE + 0x0008)))
#define U0FCR           (*((volatile unsigned long *) (MEM_BASE + 0x0008)))
#define U0LCR           (*((volatile unsigned long *) (MEM_BASE + 0x000C)))
#define U0LSR           (*((volatile unsigned long *) (MEM_BASE + 0x0014)))
#define U0SCR           (*((volatile unsigned long *) (MEM_BASE + 0x001C)))

/* UART1 */
#define U1RBR           (*((volatile unsigned long *) (MEM_BASE + 0x4000)))
#define U1THR           (*((volatile unsigned long *) (MEM_BASE + 0x4000)))
#define U1DLL           (*((volatile unsigned long *) (MEM_BASE + 0x4000)))
#define U1DLH           (*((volatile unsigned long *) (MEM_BASE + 0x4004)))
#define U1IER           (*((volatile unsigned long *) (MEM_BASE + 0x4004)))
#define U1IIR           (*((volatile unsigned long *) (MEM_BASE + 0x4008)))
#define U1FCR           (*((volatile unsigned long *) (MEM_BASE + 0x4008)))
#define U1LCR           (*((volatile unsigned long *) (MEM_BASE + 0x400C)))
#define U1LSR           (*((volatile unsigned long *) (MEM_BASE + 0x4014)))
#define U1SCR           (*((volatile unsigned long *) (MEM_BASE + 0x401C)))

/* LED0-8 */

/* LCD */

/* Interrupt Controller */
#define INTMOD          (*((volatile unsigned long *) (MEM_BASE + 0x10000)))
#define INTPND          (*((volatile unsigned long *) (MEM_BASE + 0x10004)))
#define INTMSK          (*((volatile unsigned long *) (MEM_BASE + 0x10008)))
#define INTPRI0         (*((volatile unsigned long *) (MEM_BASE + 0x1000C)))
#define INTPRI1         (*((volatile unsigned long *) (MEM_BASE + 0x10010)))
#define INTPRI2         (*((volatile unsigned long *) (MEM_BASE + 0x10014)))
#define INTPRI3         (*((volatile unsigned long *) (MEM_BASE + 0x10018)))
#define INTPRI4         (*((volatile unsigned long *) (MEM_BASE + 0x1001C)))
#define INTPRI5         (*((volatile unsigned long *) (MEM_BASE + 0x10020)))
#define INTOFFSET       (*((volatile unsigned long *) (MEM_BASE + 0x10024)))
#define INTOSET_FIQ     (*((volatile unsigned long *) (MEM_BASE + 0x10028)))
#define INTOSET_IRQ     (*((volatile unsigned long *) (MEM_BASE + 0x1002C)))
#define INTPNDPRI       (*((volatile unsigned long *) (MEM_BASE + 0x10030)))
#define INTPNDTST       (*((volatile unsigned long *) (MEM_BASE + 0x10034)))

/* memory-mapped hardware registers */
#define LED_IOCTL			0xE0008000
#define LCDC_IOCTL			0xE000C000
#define LCDC_DATA			0xE000C001

/* modeled after Hitachi HD44780 */
#define LCD_DISP_CLEAR		0x01
#define LCD_FUNCTION_SET	0x3C
#define LCD_DISP_CONTROL	0x0F
#define LCD_ENTRY_MODE		0x06

#define POWER_CONTROL_REG	0xE01FC000

void set_leds(unsigned char status);
void delay();
void do_led_animation();

void lcd_init();
void lcd_command(unsigned char cmd);
void lcd_clear();
void lcd_write_char(char c);
void lcd_write_string(char *s);

#endif /* _DEVBOARD_H_ */