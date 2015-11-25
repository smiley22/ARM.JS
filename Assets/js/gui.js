$(function() {
  var doc = CodeMirror($('#editor').get(0), {
     mode:  "armv4t",
     theme: 'hopscotch',
     value: $('#some-code').text()
  });

  $('#assemble').click(function() {
    var s = $('#status').empty();
    var c = doc.getValue();

    // Try to assemble instructions into binary image.
    try {
      var start = new Date().getTime();
      var img = ARMv4T.Assembler.Parse(c);
      var took = new Date().getTime() - start;
      s.append('<span class="success">0 error(s)</span>')
       .append('<br />')
       .append('Assembling instructions took ' + took + 'ms');
      $('#run').removeAttr('disabled');

      // Load image into VM
      Board.VM.LoadImage(img);
         updateRegisterLabels();

    } catch(e) {
      var msg = e.toString ();
      // Extract line-number from stack-trace.
      // FIXME: Only tested in Google Chrome, does this work in other browsers too?
      var a = e.stack.split("\n");
      if(a[1].match(/^.*\/(.*):(.*):.*$/))
        msg = 'Exception in ' + RegExp.$1 + ' at line ' + RegExp.$2 + ': ' +
              '<span class="error-message">' + e.message + '</span>';
      emitError(msg);
      $('#run').attr('disabled', 'disabled');
    }
  });

  $('#single-step').click(function() {
    Board.VM.Run(1);
    updateRegisterLabels();
  });

  function updateRegisterLabels() {
    var Cpu = Board.VM.Cpu;
    var D = Cpu.Dump();
    for(var o in D.GPR) {
      var elem = ($('#' + o).length) > 0 ? $('#' + o) : null;
      if(elem == null) {
        elem = $('<td class="cpu-reg-val" id="' + o + '"></td>');
        var t = $('<tr><td class="cpu-reg">' + o + '</td></tr>');
        t.append(elem);
        $('#cpu-regs').append(t);
      }
      D.GPR[o] = D.GPR[o] || 0;
      var old = elem.text();
      var n = '0x' + D.GPR[o].toUint32().toString(16).toUpperCase();
      var c = old != n ? 'val-changed' : '';
      var span = $('<span class="' + c + '">' + n + '</span>').tooltip({
        title: D.GPR[o],
        placement: 'right',
        animation: false
      });
      elem.html(span);
    }
    
    for(var o in D.CPSR) {
      var elem = ($('#' + o).length) > 0 ? $('#' + o) : null;
      if(elem == null) {
        elem = $('<td class="cpu-reg-val" id="' + o + '"></td>');
        var t = $('<tr><td class="cpu-reg">' + o + '</td></tr>');
        t.append(elem);
        $('#cpu-cpsr').append(t);
      }
      D.CPSR[o] = D.CPSR[o] || 0;
      var old = elem.text();
      var c = old != D.CPSR[o] ? 'val-changed' : '';
      var span = $('<span class="' + c + '">' + D.CPSR[o] + '</span>');
      elem.html(span);
    }
    try {
      var instr = Cpu.Memory.Read(Cpu.GPR[15] - 4, 'WORD');
      $('#instr-grp').html(Cpu.Decode(instr));
      $('#instr-val').html(instr.toString(16).toUpperCase()).tooltip({
        title: '(0b' + instr.toString(2) + ')',
        placement: 'right',
        animation: false
      });
    } catch(e) {
      console.info('could not set instr_grp');
    }
  }

  function emitError(e) {
    console.error(e);
    $('#status').append(e).append('<br />');
  }

});