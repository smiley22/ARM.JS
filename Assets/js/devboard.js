// A simple DevBoard Virtual Machine with some simple
// HW devices mapped into memory and a simple 'video'-device
// to enable printing characters to the screen from within
// ARM programs.

var Board = new ARM.Simulator.DevBoard('myDevBoard-1');

$(window).on('LED', function(e) {
  var leds = e.originalEvent.detail.params;
  for(var i = 0; i < leds.length; i++) {
    $('#led-' + i).toggleClass('led-on', leds[i] == 1);
  }
});

$(window).on('LCD-Power', function(e) {
  var status = e.originalEvent.detail.params;
  $('#lcd').toggleClass('lcd-on', status);
});
