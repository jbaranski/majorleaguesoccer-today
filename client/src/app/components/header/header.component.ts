import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-gray-800 text-center text-5xl sm:text-6xl font-bold mb-2">Major League Soccer Today</h1>
  `
})
export class HeaderComponent {}
