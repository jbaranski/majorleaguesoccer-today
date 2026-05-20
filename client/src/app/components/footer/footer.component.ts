import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center text-gray-500 text-sm mb-3">
      <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Source code</a>
      used to generate the daily fixture list is free and open source :)
    </div>
    <div class="text-center text-gray-500 text-xs font-light pb-4">
      Copyright 2025,2026 Jeff Software |
      <a href="mailto:admin@jeffsoftware.com" class="text-blue-400 hover:underline">admin@jeffsoftware.com</a> |
      <a href="https://twitter.com/jeffsoftware" target="_blank" rel="noopener" class="text-blue-400 hover:underline">@jeffsoftware</a>
    </div>
  `
})
export class FooterComponent {}
