import React from 'react'
import Select from 'react-select'

const configMixer = require('../../exported_config')
import {
    setToken,
    token,
    network,
} from '../utils/configFrontend'

function mapOptionToken(value : string) {
    return {value: value, label: configMixer.network[network].token[value].sym}
}

const options = Object.keys(configMixer.network[network].token).map(mapOptionToken)

const customStyles = {
  control: () => ({
    // none of react-select's styles are passed to <Control />
    width: "10em",
  }),
}

class TokenSelect extends React.Component {

    state = {
            selectedOption: mapOptionToken(token),
        }

    handleChange = selectedOption => {
            this.setState({ selectedOption })
            setToken(network, selectedOption.value)
        };

    render = () => {

        const { selectedOption } = this.state

        return (
            <div style={{width: '10em'}}>
                <Select
                    style={customStyles}
                    value={selectedOption}
                    onChange={this.handleChange}
                    options={options}
                    />
            </div>
            )
        }
}

export default TokenSelect
