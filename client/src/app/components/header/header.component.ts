import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-foreground text-center text-4xl sm:text-4xl font-bold mb-2">Major League Soccer Today</h1>
  `
})
export class HeaderComponent {}
