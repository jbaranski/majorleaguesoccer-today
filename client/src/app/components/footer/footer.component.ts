import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  template: `
    <hr class="footer-separator" />
    <div class="source-code">
      <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener">Source code</a> used to generate the daily fixture list is free and open source :)
    </div>
    <div class="footer">
      Copyright 2025,2026 Jeff Software |
      <a href="mailto:admin@jeffsoftware.com">admin@jeffsoftware.com</a> |
      <a href="https://twitter.com/jeffsoftware" target="_blank" rel="noopener">@jeffsoftware</a>
    </div>
  `,
  styles: []
})
export class FooterComponent {}
