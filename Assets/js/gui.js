$(function() {
  var doc = CodeMirror($('#editor').get(0), {
     mode:  "armv4t",
     theme: 'hopscotch',
     value: $('#listing-1').text().trim()
  });

  // Bootstrap tooltips are 'opt-in'
  $('[data-toggle="tooltip"], [data-tooltip="tooltip"]').tooltip();
  $('[data-toggle="popover"]').popover();

  var image = null;

  $('#assemble').click(function() {
    var s = $('#console').empty();
    var c = doc.getValue();

    // Try to assemble instructions into binary image.
    try {
      var start = new Date().getTime();
      var img = ARMv4T.Assembler.Assemble(c);
      var took = new Date().getTime() - start;
      s.append('<span class="success">0 error(s)</span>')
       .append('<br />')
       .append('Assembling instructions took ' + took + 'ms')
        .append('<br />');
      $('#run').removeAttr('disabled');

      // Load image into VM
      image = img;
      $('#reset-vm').trigger('click');

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
    try {
      Board.VM.Run(1);
      updateLabels();
    } catch(e) {
      updateLabels();
      if (e == 'PowerOffException') {
        console.log('Received PowerOffException. Powering off DevBoard.');
        $('#console')
          .append('<br/>')
          .append('<span class="error">Received PowerOffException. Stopping Simulator.</span>');
      } else {
        console.log(e);
      }
    }
  });

  $('#reset-vm').click(function() {
    Board.Reset();
    if (image)
      Board.Flash(image);
    updateLabels();
  });

  $('#image').click(function() {
    $('#elf-input-file').click();
  });

  $('#elf-input-file').change(function(e) {
    var files = e.originalEvent.target.files;
    if (files.length == 0)
      return;
    var reader = new FileReader();
    reader.onloadend = function(t) {
      var buffer = new Uint8Array(t.target.result);
      image = buffer;
      var s = $('#console').empty();
      try {
        $('#reset-vm').trigger('click');
        s.append('<span class="success">' + files[0].name + ' loaded</span>');
        $('#run').removeAttr('disabled');
      } catch(ex) {
        s.append('<br/>')
         .append('<span class="error">' + files[0].name + ': ' + ex + '</span>');
        $('#run').attr('disabled');
      }
    }
    reader.readAsArrayBuffer(files[0]);
  });

  $('#example-elf').click(function() {
    image = exampleELF;
    $('#reset-vm').trigger('click');
    var s = $('#console').empty();
    s.append('<span class="success">Example.ELF loaded</span>');
    $('#run').removeAttr('disabled');
  });

  var simulationIsRunning = false;

  $('#execute').click(function() {
    var _this = $(this);
    simulationIsRunning = _this.text() == 'Execute';
    _this.text(simulationIsRunning ? 'Stop' : 'Execute');
    if (simulationIsRunning) {
      _this.addClass('btn-danger').removeClass('btn-success');
      runSimulation();
    } else {
      _this.addClass('btn-success').removeClass('btn-danger');
    }
  });

  $('#mem-input').on('input', updateMEMLabels);

  function runSimulation() {
    try {
      Board.VM.Run(1000);
      updateLabels();
      if (simulationIsRunning) {
        window.setTimeout(function() { runSimulation(); }, 250);
      }
    } catch(e) {
      updateLabels();
      if (e == 'PowerOffException') {
        console.log('Received PowerOffException. Powering off DevBoard.');
        $('#console')
          .append('<br/>')
          .append('<span class="error">Received PowerOffException. Stopping Simulator.</span>');
        $('#execute').trigger('click');
      }
      else {
        console.log(e);
      }
    }
  }

  // event triggered by video device to render to STDOUT.
  $(window).on('VideoBlit', function(e) {
    var _char = e.originalEvent.detail;
    if (_char == "\n")
      _char = '<br/>';
    $('#console').append(_char);
  });

  function updateLabels() {
    var Cpu = Board.VM.Cpu;
    var D = Cpu.Dump();
    updateGPRLabels(D);
    updateCPSRLabels(D);
    updateINSTLabel(Cpu);
    updateMEMLabels();
  }

  function updateGPRLabels(D) {
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
  }

  function updateCPSRLabels(D) {
    for(var o in D.CPSR) {
      var elem = ($('#' + o).length) > 0 ? $('#' + o) : null;
      if(elem == null) {
        elem = $('<td class="cpu-reg-val" id="' + o + '"></td>');
        var t = $('<tr><td class="cpu-reg" id="n-' + o + '">' + o + '</td></tr>');
        t.append(elem);
        $('#cpu-cpsr').append(t);
      }
      D.CPSR[o] = D.CPSR[o] || 0;
      var old = elem.text();
      var c = old != D.CPSR[o] ? 'val-changed' : '';
      var span = $('<span class="' + c + '">' + D.CPSR[o] + '</span>');
      elem.html(span);
    }
  }

  function updateINSTLabel(Cpu) {
    try {
      var instr = Cpu.Memory.Read(Cpu.GPR[15] - 4, 'WORD');
      $('#instr-grp').html(Cpu.Decode(instr));
      $('#instr-val').html('0x' + instr.toString(16).toUpperCase()).tooltip({
        title: '(0b' + instr.toString(2) + ')',
        placement: 'right',
        animation: false
      });
    } catch(e) {
      $('#instr-grp').html('NOP');
      $('#instr-val').html('0x' + '0'.toString(16).toUpperCase());
    }
  }

  function updateMEMLabels() {
    try {
      var v = $('#mem-input').val();
      var addr = parseMemAddress(v);
      $('#vm-mem tbody tr').each(function() {
        $(this).children('td.cpu-reg').first().text('0x' + ('00000000' +
          addr.toString(16).toUpperCase()).substr(-8));
        var bytes = [];
        var word = 0;
        // read bytes rather than words as words must be aligned on word boundaries.
        for(var i = 0; i < 4; i++)
          word = word + ((Board.VM.Memory.Read(addr + i, 'BYTE') << (8 * i)) >>> 0);
        $(this).children('td:nth-child(2)').first().text('0x' + ('00000000' +
          word.toString(16).toUpperCase()).substr(-8)).tooltip({
          title: word,
          placement: 'right',
          animation: false
        });
        addr = addr + 4;
      });
    } catch(e) {
      if(e != 'Not a valid memory-address')
        console.log(e);
    }
  }

  function parseMemAddress(v) {
    if(!v)
      return 0;
    var m = v.match(/(?:0x)?([\da-h]{8})/i);
    if(!m)
      throw 'Not a valid memory-address';
    return parseInt(m[1], '16');
  }

  function emitError(e) {
    console.error(e);
    $('#console').append(e).append('<br />');
  }

});