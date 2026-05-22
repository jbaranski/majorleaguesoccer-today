import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-t border-border pt-6 mt-4 pb-4">
      <div class="text-center text-sm text-muted-foreground mb-2">
        <a href="https://github.com/jbaranski/majorleaguesoccer-today" target="_blank" rel="noopener"
          class="text-primary hover:underline">Source code</a>
        used to generate the daily fixture list is free and open source :)
      </div>
      <div class="text-center text-sm text-muted-foreground">
        Copyright 2025,2026 Jeff Software |
        <a href="mailto:admin@jeffsoftware.com" class="text-primary hover:underline">admin@jeffsoftware.com</a> |
        <a href="https://twitter.com/jeffsoftware" target="_blank" rel="noopener" class="text-primary hover:underline">@jeffsoftware</a>
      </div>
    </div>
  `
})
export class FooterComponent {}
