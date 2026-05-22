import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center pb-8 pt-2">
      <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-foreground">MLS Today</h1>
      <p class="text-sm text-muted-foreground mt-1.5">Major League Soccer · Fixtures &amp; Results</p>
    </div>
  `
})
export class HeaderComponent {}
