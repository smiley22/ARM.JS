#ifndef _DEVBOARD_H_
#define _DEVBOARD_H_

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