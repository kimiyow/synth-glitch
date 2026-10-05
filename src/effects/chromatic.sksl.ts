export const chromaticShader = `
uniform shader image;
uniform float2 resolution;
uniform float amount;
uniform float angle;

half4 main(float2 xy) {
	float2 direction = float2(cos(angle), sin(angle));
	float2 offset = direction * amount * resolution.x;
	half4 redSample = image.eval(xy + offset);
	half4 greenSample = image.eval(xy);
	half4 blueSample = image.eval(xy - offset);
	return half4(redSample.r, greenSample.g, blueSample.b, greenSample.a);
}
`;
