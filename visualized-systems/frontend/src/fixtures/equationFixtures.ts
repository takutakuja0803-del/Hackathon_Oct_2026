export interface EquationFixture {
  id: string;
  key: string;
  name: string;
  description: string;
  category: 'shifts' | 'reflections' | 'stretches' | 'combined' | 'trigonometry';
  code: string;
}

export const EQUATION_FIXTURES: EquationFixture[] = [
  {
    id: 'vertical-shift',
    key: 'A',
    name: 'Vertical Shift',
    description: 'Moving a parabola up and down along the y-axis',
    category: 'shifts',
    code: `# Base parabola
f(x) = x^2

# Shift upward by 3 units
g(x) = f(x) + 3

# Shift downward from g(x) by 5 units (net -2 from f)
h(x) = g(x) - 5`,
  },
  {
    id: 'horizontal-shift',
    key: 'B',
    name: 'Horizontal Shift',
    description: 'Moving a function horizontally along the x-axis',
    category: 'shifts',
    code: `# Base quadratic function
f(x) = x^2

# Shift right by 3 units: input replaced by (x - 3)
g(x) = f(x - 3)

# Shift left by 2 units from the original base function
h(x) = f(x + 2)`,
  },
  {
    id: 'reflections',
    key: 'C',
    name: 'Axes Reflections',
    description: 'Reflecting a cubic polynomial across x and y axes',
    category: 'reflections',
    code: `# Cubic function with distinct local extrema
f(x) = x^3 - 3x

# Vertical reflection across x-axis: -f(x)
g(x) = -f(x)

# Horizontal reflection across y-axis: f(-x)
h(x) = f(-x)`,
  },
  {
    id: 'vertical-scale',
    key: 'D',
    name: 'Vertical Scaling',
    description: 'Stretching and compressing a parabola vertically',
    category: 'stretches',
    code: `# Base parabola
f(x) = x^2

# Vertical stretch by factor of 2: values double
g(x) = 2f(x)

# Vertical compression by factor of 0.5: values halve
h(x) = 0.5f(x)`,
  },
  {
    id: 'combined-transformations',
    key: 'E',
    name: 'Combined Transformations',
    description: 'Composing horizontal shift, reflection, stretch, and vertical shift',
    code: `# Standard parent parabola
f(x) = x^2

# Shift right by 2 units
g(x) = f(x - 2)

# Reflect across x-axis, stretch by 2, and shift up by 3
h(x) = -2f(x - 2) + 3`,
    category: 'combined',
  },
  {
    id: 'sine-wave-transformations',
    key: 'F',
    name: 'Trigonometric Transformations',
    description: 'Amplitude scaling and phase shifting of a sinusoidal wave',
    category: 'trigonometry',
    code: `# Base sine wave with period 2pi
f(x) = sin(x)

# Double amplitude: vertical stretch by 2
g(x) = 2f(x)

# Shift phase right by pi/2 (~1.57) and shift upward by 1
h(x) = 2f(x - 1.57) + 1`,
  },
];
