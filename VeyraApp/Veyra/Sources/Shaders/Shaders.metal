#include <metal_stdlib>
using namespace metal;

struct VertexOut {
    float4 position [[position]];
    float2 texCoord;
};

vertex VertexOut vertexPassthrough(uint vertexID [[vertex_id]],
                                  constant float4x4 &projectionMatrix [[buffer(0)]]) {
    VertexOut out;
    
    float2 positions[6] = {
        float2(-1, -1), float2(1, -1), float2(-1, 1),
        float2(-1, 1), float2(1, -1), float2(1, 1)
    };
    
    float2 texCoords[6] = {
        float2(0, 1), float2(1, 1), float2(0, 0),
        float2(0, 0), float2(1, 1), float2(1, 0)
    };
    
    out.position = projectionMatrix * float4(positions[vertexID], 0, 1);
    out.texCoord = texCoords[vertexID];
    
    return out;
}

fragment float4 fragmentPassthrough(VertexOut in [[stage_in]],
                                    texture2d<float> tex [[texture(0)]]) {
    constexpr sampler s(filter::linear, address::clamp_to_edge);
    return tex.sample(s, in.texCoord);
}

fragment float4 fragmentWarp(VertexOut in [[stage_in]],
                             texture2d<float> tex [[texture(0)]],
                             constant float2 *offsets [[buffer(0)]],
                             constant int &triangleIndex [[buffer(1)]]) {
    constexpr sampler s(filter::linear, address::clamp_to_edge);
    
    float2 uv = in.texCoord;
    uv += offsets[triangleIndex];
    
    uv = clamp(uv, float2(0, 0), float2(1, 1));
    
    return tex.sample(s, uv);
}
