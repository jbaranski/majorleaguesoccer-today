import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hr class="border-0 border-t border-border my-4" />
    <div class="text-center text-muted-foreground text-lg mt-4 mb-3">
      <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener"
        class="text-primary hover:underline">Source code</a>
      used to generate the daily fixture list is free and open source :)
    </div>
    <div class="text-center text-muted-foreground text-base font-light">
      Copyright 2025,2026 Jeff Software |
      <a href="mailto:admin@jeffsoftware.com" class="text-primary hover:underline font-normal">admin@jeffsoftware.com</a> |
      <a href="https://twitter.com/jeffsoftware" target="_blank" rel="noopener" class="text-primary hover:underline font-normal">@jeffsoftware</a>
    </div>
  `
})
export class FooterComponent {}
