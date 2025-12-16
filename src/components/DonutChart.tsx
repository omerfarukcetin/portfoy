import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

interface DonutChartProps {
    data: Array<{
        name: string;
        value: number;
        color: string;
    }>;
    size: number;
    strokeWidth: number;
    centerText?: string;
    centerSubtext?: string;
    centerTextFontSize?: number;
    colors: any;
}

export const DonutChart: React.FC<DonutChartProps> = ({
    data,
    size,
    strokeWidth,
    centerText,
    centerSubtext,
    centerTextFontSize = 18,
    colors
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = data.reduce((sum, item) => sum + item.value, 0);

    let currentAngle = -90; // Start from top

    return (
        <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
                <G rotation={0} origin={`${size / 2}, ${size / 2} `}>
                    {data.map((item, index) => {
                        const percentage = (item.value / total) * 100;
                        const strokeDashoffset = circumference - (circumference * percentage) / 100;
                        const rotation = currentAngle;
                        currentAngle += (percentage / 100) * 360;

                        return (
                            <Circle
                                key={index}
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                stroke={item.color}
                                strokeWidth={strokeWidth}
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                rotation={rotation}
                                origin={`${size / 2}, ${size / 2}`}
                                strokeLinecap="butt"
                            />
                        );
                    })}
                </G>
            </Svg>

            {/* Center text */}
            <View style={{
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {centerText && (
                    <>
                        <Text style={{ fontSize: 12, color: colors.subText, fontWeight: '600' }}>
                            Toplam
                        </Text>
                        <Text style={{ fontSize: centerTextFontSize, color: colors.text, fontWeight: '700', marginTop: 2 }}>
                            {centerText}
                        </Text>
                        {centerSubtext && (
                            <Text style={{ fontSize: 11, color: colors.subText, marginTop: 1 }}>
                                {centerSubtext}
                            </Text>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};
